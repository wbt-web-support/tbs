import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getEffectiveUser } from "@/lib/get-effective-user";
import { getAdminClient } from "@/lib/chatbot-flow/superadmin";
import { assemblePrompt } from "@/lib/chatbot-flow/assemble-prompt";

const DEFAULT_MODEL = "gemini-3-flash-preview";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";

/**
 * Gemini 2.5 requires the "google_search" tool (not google_search_retrieval).
 * The @google/generative-ai SDK only types the legacy tool; we pass the correct format for 2.5.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GOOGLE_SEARCH_TOOL = { google_search: {} } as any;

type HistoryMessage = { role: "user" | "model" | "assistant"; parts: { text: string }[] };

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/chatbot-flow/chatbots/[id]/chat
 * Send a message as the current (effective) user. Used from dashboard or any non-admin page.
 * Auth: any authenticated user. userId and teamId are taken from effective user's business_info.
 * Body: { message: string, history?: HistoryMessage[], use_web_search?: boolean }
 * When use_web_search is true, web search grounding is enabled and the model is more likely to search.
 * Returns: { reply: string, thoughtSummary?: string }
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: chatbotId } = await params;
    if (!chatbotId) {
      return NextResponse.json({ error: "Chatbot id required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { message, history, use_web_search } = body as { message?: string; history?: HistoryMessage[]; use_web_search?: boolean };

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    const effectiveUser = await getEffectiveUser();
    const userId = effectiveUser?.userId ?? session.user.id;

    const adminClient = getAdminClient();
    const { data: biz } = await adminClient
      .from("business_info")
      .select("team_id")
      .eq("user_id", userId)
      .single();
    const teamId = (biz as { team_id?: string } | null)?.team_id ?? null;

    const userContext = { userId, teamId };
    const dataFetchClient = getAdminClient();
    const { prompt: systemPrompt, chatbot, webSearch } = await assemblePrompt(
      supabase,
      chatbotId,
      userContext,
      dataFetchClient
    );

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const modelName = (chatbot.model_name as string)?.trim() || DEFAULT_MODEL;
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    // Web search only when the user checks "Search web" for this turn.
    const shouldUseWebSearch = Boolean(use_web_search);

    const contents: { role: string; parts: { text: string }[] }[] = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "I understand and will follow these instructions." }] },
    ];

    const hist = Array.isArray(history) ? (history as HistoryMessage[]) : [];
    const recent = hist.slice(-30);
    for (const msg of recent) {
      if (!msg?.role) continue;
      const role = msg.role === "assistant" ? "model" : msg.role;
      if (role !== "user" && role !== "model") continue;
      const parts = Array.isArray(msg.parts)
        ? msg.parts.filter((p) => p?.text)
        : typeof (msg as unknown as { content?: string }).content === "string"
          ? [{ text: (msg as unknown as { content: string }).content }]
          : [];
      if (parts.length === 0) continue;
      contents.push({ role, parts });
    }
    contents.push({ role: "user", parts: [{ text: message }] });

    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: 2048,
      temperature: 0.4,
    };
    if (modelName.includes("2.5")) {
      (generationConfig as Record<string, unknown>).thinkingConfig = {
        thinkingBudget: 0,
        includeThoughts: false,
      };
    }

    const payload = {
      contents,
      generationConfig,
      ...(shouldUseWebSearch ? { tools: [GOOGLE_SEARCH_TOOL] } : {}),
    };
    const result = await model.generateContent(payload as Parameters<typeof model.generateContent>[0]);

    const response = result.response;
    if (!response?.candidates?.length) {
      return NextResponse.json({ error: "No response from model" }, { status: 502 });
    }

    const parts = response.candidates[0].content?.parts ?? [];
    let text = "";
    let thoughtSummary = "";

    for (const part of parts) {
      const p = part as { text?: string; thought?: boolean };
      if (p.text) {
        if (p.thought) {
          thoughtSummary += p.text;
        } else {
          text += p.text;
        }
      }
    }

    return NextResponse.json({
      reply: text.trim(),
      thoughtSummary: thoughtSummary.trim() || undefined,
    });
  } catch (err) {
    console.error("[chatbot-flow/chatbots/[id]/chat] error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("authenticated") || msg.includes("Not authenticated")) {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    if (msg.includes("fetch failed") || msg.includes("Error fetching")) {
      return NextResponse.json(
        {
          error:
            "Could not reach Gemini API. Check NEXT_PUBLIC_GEMINI_API_KEY in .env and that the server can reach https://generativelanguage.googleapis.com.",
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

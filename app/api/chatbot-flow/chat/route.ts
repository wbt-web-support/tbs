import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin, getAdminClient } from "@/lib/chatbot-flow/superadmin";
import { assemblePrompt } from "@/lib/chatbot-flow/assemble-prompt";

const DEFAULT_MODEL = "gemini-3-flash-preview";
const API_KEY = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";

type HistoryMessage = { role: "user" | "model" | "assistant"; parts: { text: string }[] };

/**
 * Gemini 2.5 requires the "google_search" tool (not google_search_retrieval).
 * The @google/generative-ai SDK only types the legacy tool; we pass the correct format for 2.5.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GOOGLE_SEARCH_TOOL = { google_search: {} } as any;

export async function POST(request: NextRequest) {
  try {
    const supabase = await verifySuperAdmin();
    const body = await request.json();
    const { chatbotId, message, history, includeThoughts, userId, teamId, use_web_search } = body;

    if (!chatbotId || typeof chatbotId !== "string") {
      return NextResponse.json({ error: "chatbotId is required" }, { status: 400 });
    }
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    const userContext = (userId != null || teamId != null)
      ? { userId: userId ?? null, teamId: teamId ?? null }
      : undefined;
    // Always use service-role for data fetch: platform-wide (scope: "all") nodes need full data; "Test as user" needs correct user/team filter.
    const dataFetchClient = getAdminClient();
    const { prompt: systemPrompt, chatbot, webSearch } = await assemblePrompt(supabase, chatbotId, userContext, dataFetchClient);
    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const modelName = (chatbot.model_name as string)?.trim() || DEFAULT_MODEL;
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    // Enable web search when the chatbot has the web_search node, or when the user checks "Search web".
    const shouldUseWebSearch = Boolean(use_web_search) || webSearch != null;

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
    // Thinking/reasoning is disabled; set thinkingBudget: 0 to turn off extended thinking
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
    console.error("[chatbot-flow/chat] error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("authenticated") || message.includes("Super admin")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes("fetch failed") || message.includes("Error fetching")) {
      return NextResponse.json(
        {
          error:
            "Could not reach Gemini API. Check NEXT_PUBLIC_GEMINI_API_KEY in .env and that the server can reach https://generativelanguage.googleapis.com.",
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

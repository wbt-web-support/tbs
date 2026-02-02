import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdminClient } from "@/lib/chatbot-flow/superadmin";
import { assemblePrompt } from "@/lib/chatbot-flow/assemble-prompt";

const DEFAULT_MODEL = "gemini-3-flash-preview";
// Prefer server-only key so API routes always have it; fall back to NEXT_PUBLIC_ for parity with admin test UI
const API_KEY = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";

/**
 * Gemini 2.5 requires the "google_search" tool (not google_search_retrieval).
 * The @google/generative-ai SDK only types the legacy tool; we pass the correct format for 2.5.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GOOGLE_SEARCH_TOOL = { google_search: {} } as any;

type HistoryMessage = { role: "user" | "model" | "assistant"; parts: { text: string }[] };

type AttachmentInput =
  | { type: "image"; url: string }
  | { type: "document"; text: string; fileName: string };

type Params = { params: Promise<{ id: string }> };

/** Fetch image from URL and return base64 + mimeType for Gemini inlineData. */
async function imageUrlToInlineData(url: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "image/*" } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const base64 = buf.toString("base64");
    const contentType = res.headers.get("content-type") || "image/png";
    const mimeType = contentType.split(";")[0].trim();
    return { inlineData: { mimeType, data: base64 } };
  } catch {
    return null;
  }
}

/**
 * POST /api/chatbot-flow/chatbots/[id]/chat
 * Send a message as the current (effective) user. Used from dashboard or any non-admin page.
 * Auth: any authenticated user. userId and teamId are taken from effective user's business_info.
 * Body: { message: string, history?: HistoryMessage[], use_web_search?: boolean, attachments?: AttachmentInput[] }
 * attachments: images (url) and documents (extracted text + fileName). Only used when chatbot has attachments node.
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
    const { message, history, use_web_search, attachments } = body as {
      message?: string;
      history?: HistoryMessage[];
      use_web_search?: boolean;
      attachments?: AttachmentInput[];
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    // Use the logged-in user directly so the chatbot has access to their context (team, data).
    const userId = session.user.id;
    const adminClient = getAdminClient();
    const { data: biz } = await adminClient
      .from("business_info")
      .select("team_id")
      .eq("user_id", userId)
      .single();
    const teamId = (biz as { team_id?: string } | null)?.team_id ?? null;
    const userContext = { userId, teamId };
    const dataFetchClient = getAdminClient();
    const { prompt: systemPrompt, chatbot, webSearch, attachments: attachmentsConfig } = await assemblePrompt(
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

    // Enable web search when the chatbot has the web_search node, or when the user checks "Search web".
    const shouldUseWebSearch = Boolean(use_web_search) || webSearch != null;

    type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };
    const contents: { role: string; parts: ContentPart[] }[] = [
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

    // Build last user message parts: text, then images (inlineData), then document texts
    const lastUserParts: ContentPart[] = [{ text: message }];
    const attachmentList = Array.isArray(attachments) && attachmentsConfig ? (attachments as AttachmentInput[]) : [];
    for (const att of attachmentList) {
      if (att.type === "image" && att.url) {
        const part = await imageUrlToInlineData(att.url);
        if (part) lastUserParts.push(part);
      } else if (att.type === "document" && att.text) {
        lastUserParts.push({
          text: `[Attachment: ${(att as { fileName?: string }).fileName ?? "document"}]\n${att.text}`,
        });
      }
    }
    contents.push({ role: "user", parts: lastUserParts });

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
            "Could not reach Gemini API. If it works in Admin → Chatbot Flow test UI, add GEMINI_API_KEY to .env.local (same value as NEXT_PUBLIC_GEMINI_API_KEY) and restart the dev server.",
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

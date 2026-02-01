import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin, getAdminClient } from "@/lib/chatbot-flow/superadmin";
import { assemblePrompt } from "@/lib/chatbot-flow/assemble-prompt";

const DEFAULT_MODEL = "gemini-2.5-flash";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";

type HistoryMessage = { role: "user" | "model"; parts: { text: string }[] };

export async function POST(request: NextRequest) {
  try {
    const supabase = await verifySuperAdmin();
    const body = await request.json();
    const { chatbotId, message, history, includeThoughts, userId, teamId } = body;

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
    const dataFetchClient = userContext ? getAdminClient() : undefined;
    const { prompt: systemPrompt, chatbot } = await assemblePrompt(supabase, chatbotId, userContext, dataFetchClient);
    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const modelName = (chatbot.model_name as string)?.trim() || DEFAULT_MODEL;
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    const contents: { role: string; parts: { text: string }[] }[] = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "I understand and will follow these instructions." }] },
    ];

    const hist = Array.isArray(history) ? (history as HistoryMessage[]) : [];
    const recent = hist.slice(-30);
    for (const msg of recent) {
      if (msg?.role && Array.isArray(msg.parts)) {
        const role = msg.role === "assistant" ? "model" : msg.role;
        if (role !== "user" && role !== "model") continue;
        contents.push({
          role,
          parts: msg.parts.filter((p) => p?.text),
        });
      }
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

    const result = await model.generateContent({
      contents,
      generationConfig: generationConfig as Parameters<typeof model.generateContent>[0]["generationConfig"],
    });

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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

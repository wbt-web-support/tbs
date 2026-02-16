import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * POST /api/chatbot-flow/transcribe
 * Transcribe audio to text using Gemini.
 * Auth: any authenticated user.
 * Accepts FormData with a "file" field (audio blob).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    const mimeType = file.type || "audio/webm";

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Audio,
        },
      },
      { text: "Transcribe this audio to text. Return only the transcription, nothing else." },
    ]);

    const response = result.response;
    const text = response.text().trim();

    if (!text) {
      return NextResponse.json({ error: "No transcription returned" }, { status: 500 });
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("[chatbot-flow/transcribe] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transcription failed" },
      { status: 500 }
    );
  }
}

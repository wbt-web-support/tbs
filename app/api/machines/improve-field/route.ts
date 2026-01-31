import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const MODEL_NAME = "gemini-2.5-flash-lite";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

const genAI = new GoogleGenerativeAI(API_KEY);

/** Single prompt for all improve requests: polish only (grammar, spelling, flow). No audience or business context. */
const IMPROVE_PROMPT = `Improve the following text. Only fix:
- Grammar and spelling (use British English: fulfilment, colour, organise, centre, favour, behaviour)
- Flow and clarity
- Word choice where it helps readability

Keep the same meaning. Do not add or remove content. Do not change the tone or who it is written for (e.g. do not rewrite "we" as "you" or vice versa). Do not add marketing or customer-facing language.

If the text is a list (multiple lines or items), keep it as a list in the same format (one item per line; you may number them).

Return ONLY the improved text, nothing else. No quotes, no explanations.`;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { current_value } = body;

    const text = typeof current_value === "string" ? current_value.trim() : "";
    if (!text) {
      return NextResponse.json(
        { error: "Missing or invalid current_value" },
        { status: 400 }
      );
    }

    const prompt = `${IMPROVE_PROMPT}\n\nText to improve:\n${text}`;

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const improvedValue = response.text().trim();

    // Clean up the response (remove quotes if present)
    const cleanedValue = improvedValue
      .replace(/^["']|["']$/g, "")
      .replace(/^`|`$/g, "")
      .trim();

    return NextResponse.json({
      success: true,
      improved_value: cleanedValue,
    });
  } catch (error) {
    console.error("Error improving field:", error);
    return NextResponse.json(
      {
        error: "Failed to improve field",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

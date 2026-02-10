import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const MODEL_NAME = "gemini-2.5-flash-lite";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { instruction, documentHtml } = body as {
      instruction: string;
      documentHtml: string;
    };

    if (!instruction?.trim()) {
      return NextResponse.json(
        { error: "Missing instruction" },
        { status: 400 }
      );
    }

    if (!documentHtml?.trim()) {
      return NextResponse.json(
        { error: "No document content to edit" },
        { status: 400 }
      );
    }

    const prompt = `You are an expert business plan editor. You are given a business plan document in HTML and a user instruction describing what to change.

CRITICAL RULES:
- Apply ONLY the change described in the instruction. Do not alter anything else.
- You MUST preserve the existing HTML structure, tags, and formatting exactly.
- Keep ALL the same HTML tags: <h1>, <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>, <a>, <blockquote>, <table>, <tr>, <td>, <th>, etc.
- Do NOT strip formatting — if text is bold (<strong>), keep it bold. If it's a list, keep it as a list.
- Do NOT convert HTML to plain text or Markdown.
- Do not add or remove sections unless the instruction specifically asks for it.
- Write in first person (we/our) or internal strategy tone — not marketing tone.
- Use British English.
- Return ONLY the full updated HTML document. No explanation, no markdown code fences, no wrapping text.
- Do NOT wrap your response in \`\`\`html code fences.

USER INSTRUCTION:
${instruction.trim()}

CURRENT DOCUMENT HTML:
${documentHtml}`;

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let updatedHtml = response.text().trim();

    // Strip markdown code fences if the model wraps the response
    updatedHtml = updatedHtml
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return NextResponse.json({ success: true, updatedHtml });
  } catch (error) {
    console.error("Error in business-plan edit-document:", error);
    return NextResponse.json(
      {
        error: "Failed to edit document",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

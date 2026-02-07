import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const MODEL_NAME = "gemini-2.5-flash-lite";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const PLAIN_TEXT_RULE =
  "CRITICAL: Return plain text only. Do not use Markdown: no ** or __ for bold, no * or _ for emphasis, no # for headings, no backticks. For lists use one line per item with no leading asterisks or dashes—just the text, one line per bullet. Do NOT include the field name or any title/heading in your response (e.g. do not start with 'Core values', '1-Year Targets', 'Five-Year Targets', or similar). Return only the content itself.";

const PREDEFINED_PROMPTS: Record<string, string> = {
  "more_concise": "Make the following text more concise. Keep the same meaning and key points but use fewer words. Return ONLY the revised text, no explanations.",
  "more_professional": "Rewrite the following text in a more professional tone. Keep the same meaning. Use British English. Return ONLY the revised text, no explanations.",
  "improve_clarity": "Improve the clarity and readability of the following text. Fix grammar and flow. Use British English. Return ONLY the improved text, no explanations.",
  "expand_examples": "Expand the following text with one or two concrete examples where helpful. Keep the same tone and length reasonable. Return ONLY the revised text, no explanations.",
};

/** Strip markdown to plain text so fields display correctly (no raw ** or * in UI). */
function stripMarkdownToPlainText(text: string): string {
  if (!text?.trim()) return text;
  let out = text
    // Remove code fences
    .replace(/^```[\s\S]*?```$/gm, "")
    .replace(/`[^`]*`/g, (m) => m.slice(1, -1))
    // Unbold: **x** or __x__
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    // Un-italic: *x* or _x_ (single, not at start of line as list)
    .replace(/(?<!\n)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/(?<!\n)_([^_\n]+)_(?!_)/g, "$1")
    // Heading: # ## ### etc
    .replace(/^#+\s*/gm, "")
    // List: line starting with * or - or • (optional space after)
    .replace(/^[\s]*[-*•]\s+/gm, "")
    // Trailing list asterisk that might be left
    .replace(/^[\s]*\*\s+/gm, "");
  return out.trim();
}

/** Remove a leading line if it looks like a title (e.g. field name or "X:"). */
function stripLeadingTitle(text: string, fieldLabel: string): string {
  if (!text?.trim()) return text;
  const lines = text.split(/\n/).map((l) => l.trim());
  if (lines.length === 0) return text;
  const first = lines[0];
  const labelLower = fieldLabel.toLowerCase();
  const firstLower = first.toLowerCase();
  if (
    firstLower === labelLower ||
    firstLower === `${labelLower}:` ||
    firstLower.startsWith(`${labelLower}:`) ||
    /^(1[- ]?year|5[- ]?year|five[- ]?year|one[- ]?year)\s*(targets?)?:?\s*$/i.test(first) ||
    /^(core\s+values?|strategic\s+anchors?|purpose\s*&\s*why):?\s*$/i.test(first)
  ) {
    return lines.slice(1).join("\n").trim();
  }
  return text;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { instruction, fields } = body as {
      instruction: string;
      fields: { fieldId: string; label: string; currentValue: string }[];
    };

    if (!instruction || !Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json(
        { error: "Missing instruction or fields" },
        { status: 400 }
      );
    }

    const instructionPrompt =
      PREDEFINED_PROMPTS[instruction] ||
      `Apply this instruction to the text: ${instruction}. Return ONLY the revised text, no explanations. Use British English where relevant.`;

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const improved: Record<string, string> = {};

    const generatePrompt = (label: string, instruction: string) =>
      `Generate content for this business plan field. Field: ${label}. Instruction or style: ${instruction}. Return ONLY the generated text, no explanations. Use British English.`;

    for (const f of fields) {
      const text = (f.currentValue || "").trim();
      const basePrompt = text
        ? `${instructionPrompt}\n\n${PLAIN_TEXT_RULE}\n\nField: ${f.label}\n\nText:\n${text}`
        : `${generatePrompt(f.label, instructionPrompt)}\n\n${PLAIN_TEXT_RULE}`;
      const result = await model.generateContent(basePrompt);
      const response = await result.response;
      let value = response.text().trim();
      value = value.replace(/^["']|["']$/g, "").replace(/^`|`$/g, "").trim();
      value = stripMarkdownToPlainText(value);
      value = stripLeadingTitle(value, f.label);
      improved[f.fieldId] = value;
    }

    return NextResponse.json({ success: true, improved });
  } catch (error) {
    console.error("Error in business-plan improve:", error);
    return NextResponse.json(
      {
        error: "Failed to improve",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

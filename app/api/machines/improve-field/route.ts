import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const MODEL_NAME = "gemini-2.5-flash-lite";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

const genAI = new GoogleGenerativeAI(API_KEY);

/** Instruction for AI to use British English in all responses */
const UK_ENGLISH_INSTRUCTION =
  "Use British English spelling and conventions throughout (e.g. fulfilment, colour, organise, centre, favour, behaviour). ";

/** Tone: internal documentation for business owners, not customer-facing */
const INTERNAL_TOOL_TONE =
  "This is an internal tool for business owners documenting their own processes. Write in first person (we/our) or as internal process notes. Do NOT write as if talking to customers or in marketing/sales tone. ";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { field_name, current_value, machine_type, context, growth_context } = body;

    if (!field_name || !current_value || !machine_type) {
      return NextResponse.json(
        { error: "Missing required fields: field_name, current_value, machine_type" },
        { status: 400 }
      );
    }

    // Build context for AI
    let contextInfo = "";
    if (context) {
      contextInfo += "\n\nContext from current answers:\n";
      if (context.primary_service) {
        contextInfo += `- Service: ${context.primary_service}\n`;
      }
      if (context.service_description) {
        contextInfo += `- Description: ${context.service_description}\n`;
      }
      if (context.traffic_sources && context.traffic_sources.length > 0) {
        contextInfo += `- Traffic Sources: ${context.traffic_sources.join(", ")}\n`;
      }
      if (context.ending_event) {
        contextInfo += `- Ending Event: ${context.ending_event}\n`;
      }
      if (context.actions_activities && context.actions_activities.length > 0) {
        contextInfo += `- Actions: ${context.actions_activities.filter((a: string) => a).join(", ")}\n`;
      }
    }

    // Add growth context for fulfillment machines
    if (machine_type === "fulfillment" && growth_context) {
      contextInfo += "\n\nContext from Growth Machine:\n";
      if (growth_context.primary_service) {
        contextInfo += `- Service: ${growth_context.primary_service}\n`;
      }
      if (growth_context.service_description) {
        contextInfo += `- Description: ${growth_context.service_description}\n`;
      }
      if (growth_context.ending_event) {
        contextInfo += `- Growth Ending Event (becomes Fulfillment start): ${growth_context.ending_event}\n`;
      }
      if (growth_context.actions_activities && growth_context.actions_activities.length > 0) {
        contextInfo += `- Growth Process: ${growth_context.actions_activities.filter((a: string) => a).join(" → ")}\n`;
      }
    }

    // Build prompt based on field type
    let prompt = "";
    
    if (field_name === "primary_service") {
      prompt = `${UK_ENGLISH_INSTRUCTION}${INTERNAL_TOOL_TONE}You are helping to improve a service name for a ${machine_type} machine.

Current value: "${current_value}"
${contextInfo}

Please improve this service name to be:
1. Clear and specific
2. Professional and descriptive
3. Easy to understand
4. Concise (2-5 words)

Return ONLY the improved service name, nothing else. No quotes, no explanations.`;
    } else if (field_name === "service_description") {
      prompt = `${UK_ENGLISH_INSTRUCTION}${INTERNAL_TOOL_TONE}You are helping to improve a service description for a ${machine_type} machine.

Current value: "${current_value}"
${contextInfo}

Please improve this description to be:
1. Simple and easy to read (1-2 short sentences)
2. Say who it's for
3. Use everyday language - no jargon
4. Keep it brief and clear

Return ONLY the improved description, nothing else. No quotes, no explanations.`;
    } else if (field_name === "ending_event") {
      prompt = `${UK_ENGLISH_INSTRUCTION}${INTERNAL_TOOL_TONE}You are helping to improve an ending event/success point for a ${machine_type} machine.

Current value: "${current_value}"
${contextInfo}

Please improve this ending event to be:
1. Clear and specific about what marks success
2. Measurable or observable
3. Concise (1 sentence)
4. Professional

Return ONLY the improved ending event, nothing else. No quotes, no explanations.`;
    } else if (field_name === "completion_event") {
      prompt = `${UK_ENGLISH_INSTRUCTION}${INTERNAL_TOOL_TONE}You are helping to improve a completion event for a fulfilment machine.

Current value: "${current_value}"
${contextInfo}

Please improve this completion event to be:
1. Clear about what marks full job completion
2. Includes all key closure activities
3. Concise (1 sentence)
4. Professional

Return ONLY the improved completion event, nothing else. No quotes, no explanations.`;
    } else if (field_name === "activity_item") {
      const activityType = machine_type === "growth" ? "growth process step" : "fulfilment step";
      prompt = `${UK_ENGLISH_INSTRUCTION}${INTERNAL_TOOL_TONE}You are helping to improve a ${activityType} description.

Current value: "${current_value}"
${contextInfo}

Please improve this step to be:
1. Clear and actionable
2. Specific with relevant details (timing, conditions, etc.)
3. Professional but practical
4. Concise (1 sentence or short phrase)

Return ONLY the improved step description, nothing else. No quotes, no explanations.`;
    } else if (field_name === "all_activities") {
      const activityType = machine_type === "growth"
        ? "growth process (from discovery to sale)"
        : "fulfilment process (from sale to completion)";
      prompt = `${UK_ENGLISH_INSTRUCTION}${INTERNAL_TOOL_TONE}You are helping to improve and structure a list of steps in a ${activityType}.

Current steps (one per line):
${current_value}
${contextInfo}

Please improve these steps to be:
1. Simple and easy to read
2. Short - use 5-8 words max per step
3. Use everyday language - no fancy words or jargon
4. Clear and actionable

IMPORTANT:
- DO NOT invent new steps
- ONLY improve and clarify the steps provided
- Keep it simple and conversational
- Make each step brief (5-8 words)
- NO markdown formatting (no **, no *, no bold, no italic)
- NO category labels or prefixes (like "Marketing Activity:", "Website:", etc.)
- Just write simple, plain descriptions

Return ONLY the improved steps, one per line, numbered. Keep them short and simple.`;
    } else {
      // Generic improvement
      prompt = `${UK_ENGLISH_INSTRUCTION}${INTERNAL_TOOL_TONE}You are helping to improve a field for a ${machine_type} machine.

Field: ${field_name}
Current value: "${current_value}"
${contextInfo}

Please improve this text to be:
1. Clear and professional
2. Specific and actionable
3. Concise and easy to understand
4. Contextually appropriate

Return ONLY the improved text, nothing else. No quotes, no explanations.`;
    }

    // Call Gemini API
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
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

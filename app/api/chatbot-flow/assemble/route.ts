import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin, getAdminClient } from "@/lib/chatbot-flow/superadmin";
import { assemblePrompt, assemblePromptStructured } from "@/lib/chatbot-flow/assemble-prompt";

export async function POST(request: NextRequest) {
  try {
    const supabase = await verifySuperAdmin();
    const body = await request.json();
    const { chatbotId, userId, teamId, structured } = body;

    if (!chatbotId || typeof chatbotId !== "string") {
      return NextResponse.json({ error: "chatbotId is required" }, { status: 400 });
    }

    const userContext = (userId != null || teamId != null) ? { userId, teamId } : undefined;
    // Always use service-role for data fetch: platform-wide nodes need full data; "Test as user" needs correct user/team filter.
    const dataFetchClient = getAdminClient();

    if (structured) {
      const result = await assemblePromptStructured(supabase, chatbotId, userContext, dataFetchClient);
      if (!result.chatbot) {
        return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
      }
      return NextResponse.json({
        prompt: result.prompt,
        chatbotId,
        chatbotName: result.chatbot.name,
        basePrompt: result.basePrompt,
        instructionBlocks: result.instructionBlocks,
        dataModules: result.dataModules,
      });
    }

    const { prompt, chatbot } = await assemblePrompt(supabase, chatbotId, userContext, dataFetchClient);

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    return NextResponse.json({ prompt, chatbotId, chatbotName: chatbot.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message.includes("authenticated") ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdminClient } from "@/lib/chatbot-flow/superadmin";
import { assemblePromptStructured } from "@/lib/chatbot-flow/assemble-prompt";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/chatbot-flow/public/chatbots/[id]/context
 * Returns the assembled context for the current (logged-in) user so the app can show a debug panel.
 * Auth: any authenticated user. Uses session user + their business_info team_id.
 */
export async function GET(request: NextRequest, { params }: Params) {
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

    const userId = session.user.id;
    const adminClient = getAdminClient();
    const { data: biz } = await adminClient
      .from("business_info")
      .select("team_id")
      .eq("user_id", userId)
      .single();
    const teamId = (biz as { team_id?: string } | null)?.team_id ?? null;
    const userContext = { userId, teamId };

    const result = await assemblePromptStructured(
      supabase,
      chatbotId,
      userContext,
      adminClient
    );

    if (!result.chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    return NextResponse.json({
      basePrompt: result.basePrompt,
      instructionBlocks: result.instructionBlocks,
      dataModules: result.dataModules,
      fullPrompt: result.prompt,
      webSearchEnabled: !!result.webSearch,
      attachmentsEnabled: !!result.attachments,
      voiceEnabled: !!result.voice,
      voiceConfig: result.voice,
      sttInputEnabled: !!result.sttInput,
    });
  } catch (err) {
    console.error("[chatbot-flow/public/chatbots/[id]/context]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

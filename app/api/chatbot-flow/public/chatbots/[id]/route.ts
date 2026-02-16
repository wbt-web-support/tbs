import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/chatbot-flow/public/chatbots/[id]
 * Get one chatbot's details for display elsewhere (e.g. chat header).
 * Auth: any authenticated user.
 * Returns safe fields only (no base_prompts). 404 if not found or inactive.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Chatbot id required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("chatbots")
      .select("id, name, is_active, model_name")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const { data: links } = await supabase
      .from("chatbot_flow_node_links")
      .select("node_key")
      .eq("chatbot_id", id);
    const nodeKeys = Array.isArray(links) ? (links as { node_key?: string }[]).map((l) => l.node_key) : [];
    const hasWebSearch = nodeKeys.includes("web_search");
    const hasAttachments = nodeKeys.includes("attachments");
    const hasVoice = nodeKeys.includes("voice_interface");
    const hasSttInput = nodeKeys.includes("stt_input");

    return NextResponse.json({ ...data, webSearchEnabled: !!hasWebSearch, attachmentsEnabled: !!hasAttachments, voiceEnabled: !!hasVoice, sttInputEnabled: !!hasSttInput });
  } catch (err) {
    console.error("[chatbot-flow/public/chatbots/[id]] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

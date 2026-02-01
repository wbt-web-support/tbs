import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/chatbot-flow/superadmin";

type Params = { params: Promise<{ id: string; nodeId: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const supabase = await verifySuperAdmin();
    const { id: chatbotId, nodeId } = await params;

    const { error } = await supabase
      .from("chatbot_flow_node_links")
      .delete()
      .eq("chatbot_id", chatbotId)
      .eq("node_key", nodeId);

    if (error) {
      console.error("[chatbot-flow/chatbots/:id/nodes/:nodeId] DELETE error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message.includes("authenticated") ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const supabase = await verifySuperAdmin();
    const { id: chatbotId, nodeId } = await params;

    const body = await request.json();
    const { order_index, settings } = body;

    const updates: { order_index?: number; settings?: Record<string, unknown> } = {};
    if (typeof order_index === "number") updates.order_index = order_index;
    if (settings != null && typeof settings === "object") updates.settings = settings;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "order_index or settings required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("chatbot_flow_node_links")
      .update(updates)
      .eq("chatbot_id", chatbotId)
      .eq("node_key", nodeId)
      .select("id, chatbot_id, node_key, order_index, settings, created_at")
      .single();

    if (error) {
      console.error("[chatbot-flow/chatbots/:id/nodes/:nodeId] PUT error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message.includes("authenticated") ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

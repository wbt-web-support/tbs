import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/chatbot-flow/superadmin";
import { getNodeDefinition } from "@/lib/chatbot-flow/nodes";

type Params = { params: Promise<{ id: string }> };

type LinkRow = {
  id: string;
  node_key: string;
  order_index: number;
  settings: Record<string, unknown> | null;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const supabase = await verifySuperAdmin();
    const { id: chatbotId } = await params;

    const { data: links, error: linksError } = await supabase
      .from("chatbot_flow_node_links")
      .select("id, node_key, order_index, settings")
      .eq("chatbot_id", chatbotId)
      .order("order_index", { ascending: true });

    if (linksError) {
      console.error("[chatbot-flow/chatbots/:id/nodes] GET links error:", linksError);
      return NextResponse.json({ error: linksError.message }, { status: 500 });
    }

    if (!links?.length) return NextResponse.json({ nodes: [] });

    const linkRows = links as LinkRow[];

    const result = linkRows.map((l) => {
      const linkSettings = (l.settings ?? {}) as Record<string, unknown>;
      const def = getNodeDefinition(l.node_key);
      return {
        id: l.node_key,
        node_key: l.node_key,
        name: def?.name ?? l.node_key,
        node_type: def?.nodeType ?? "data_access",
        settings: linkSettings,
        order_index: l.order_index,
        link_id: l.id,
      };
    });

    return NextResponse.json({ nodes: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message.includes("authenticated") ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const supabase = await verifySuperAdmin();
    const { id: chatbotId } = await params;

    const body = await request.json();
    const { node_key, position, settings: bodySettings } = body;
    if (!node_key || typeof node_key !== "string") {
      return NextResponse.json({ error: "node_key is required" }, { status: 400 });
    }

    const def = getNodeDefinition(node_key);
    if (!def) {
      return NextResponse.json({ error: "Unknown node key" }, { status: 400 });
    }

    const { data: max } = await supabase
      .from("chatbot_flow_node_links")
      .select("order_index")
      .eq("chatbot_id", chatbotId)
      .order("order_index", { ascending: false })
      .limit(1)
      .single();
    const nextOrder = (max?.order_index ?? -1) + 1;

    const initialSettings =
      typeof bodySettings === "object" && bodySettings !== null
        ? { ...def.defaultSettings, ...bodySettings }
        : position != null && typeof position === "object"
          ? { ...def.defaultSettings, position }
          : def.defaultSettings;

    const { data, error } = await supabase
      .from("chatbot_flow_node_links")
      .insert({
        chatbot_id: chatbotId,
        node_key,
        order_index: nextOrder,
        settings: initialSettings,
      })
      .select("id, chatbot_id, node_key, order_index, settings, created_at")
      .single();

    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Node already attached" }, { status: 409 });
      console.error("[chatbot-flow/chatbots/:id/nodes] POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message.includes("authenticated") ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

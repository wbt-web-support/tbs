import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/chatbot-flow/superadmin";

export async function GET() {
  try {
    const supabase = await verifySuperAdmin();
    const { data: chatbots, error } = await supabase
      .from("chatbots")
      .select("id, name, base_prompts, is_active, model_name, created_by, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[chatbot-flow/chatbots] GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = chatbots ?? [];
    if (list.length === 0) return NextResponse.json({ chatbots: [] });

    const { data: links } = await supabase
      .from("chatbot_flow_node_links")
      .select("chatbot_id")
      .in("chatbot_id", list.map((c) => c.id));

    const countByChatbot: Record<string, number> = {};
    for (const c of list) countByChatbot[c.id] = 0;
    for (const l of links ?? []) {
      if (countByChatbot[l.chatbot_id] !== undefined) countByChatbot[l.chatbot_id]++;
    }

    const withCount = list.map((c) => ({ ...c, node_count: countByChatbot[c.id] ?? 0 }));
    return NextResponse.json({ chatbots: withCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message.includes("authenticated") ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await verifySuperAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await request.json();
    const { name, base_prompts, model_name, is_active } = body;
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("chatbots")
      .insert({
        name: name.trim(),
        base_prompts: Array.isArray(base_prompts) ? base_prompts : [],
        model_name: typeof model_name === "string" ? model_name : null,
        is_active: typeof is_active === "boolean" ? is_active : true,
        created_by: user.id,
      })
      .select("id, name, base_prompts, is_active, model_name, created_by, created_at, updated_at")
      .single();

    if (error) {
      console.error("[chatbot-flow/chatbots] POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message.includes("authenticated") ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/chatbot-flow/superadmin";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const supabase = await verifySuperAdmin();
    const { id } = await params;

    const { data, error } = await supabase
      .from("chatbots")
      .select("id, name, base_prompts, is_active, model_name, created_by, created_at, updated_at")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message.includes("authenticated") ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const supabase = await verifySuperAdmin();
    const { id } = await params;

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.name === "string") updates.name = body.name.trim();
    if (Array.isArray(body.base_prompts)) updates.base_prompts = body.base_prompts;
    if (typeof body.model_name === "string") updates.model_name = body.model_name; else if (body.model_name === null) updates.model_name = null;
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

    if (Object.keys(updates).length === 0) {
      const { data } = await supabase.from("chatbots").select("*").eq("id", id).single();
      return NextResponse.json(data);
    }

    const { data, error } = await supabase
      .from("chatbots")
      .update(updates)
      .eq("id", id)
      .select("id, name, base_prompts, is_active, model_name, created_by, created_at, updated_at")
      .single();

    if (error) {
      console.error("[chatbot-flow/chatbots] PUT error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message.includes("authenticated") ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const supabase = await verifySuperAdmin();
    const { id } = await params;

    const { error } = await supabase.from("chatbots").delete().eq("id", id);

    if (error) {
      console.error("[chatbot-flow/chatbots] DELETE error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message.includes("authenticated") ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

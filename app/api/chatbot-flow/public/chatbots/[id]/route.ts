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

    return NextResponse.json(data);
  } catch (err) {
    console.error("[chatbot-flow/public/chatbots/[id]] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

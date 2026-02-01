import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/chatbot-flow/public/chatbots
 * List chatbots for display elsewhere in the app (e.g. dashboard).
 * Auth: any authenticated user.
 * Returns only active chatbots with safe fields (no base_prompts).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: chatbots, error } = await supabase
      .from("chatbots")
      .select("id, name, is_active, model_name")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("[chatbot-flow/public/chatbots] GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ chatbots: chatbots ?? [] });
  } catch (err) {
    console.error("[chatbot-flow/public/chatbots] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

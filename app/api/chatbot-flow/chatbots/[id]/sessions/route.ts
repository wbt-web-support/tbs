import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type Params = { params: Promise<{ id: string }> };

/** GET /api/chatbot-flow/chatbots/[id]/sessions - List chat sessions for this chatbot (current user) */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: chatbotId } = await params;
    if (!chatbotId) {
      return NextResponse.json({ error: "Chatbot id required" }, { status: 400 });
    }

    const { data: rows, error } = await supabase
      .from("chat_history")
      .select("id, title, created_at, updated_at")
      .eq("user_id", session.user.id)
      .eq("chatbot_id", chatbotId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[chatbot-flow/sessions] list error:", error);
      return NextResponse.json({ error: "Failed to list sessions" }, { status: 500 });
    }

    const sessions = (rows ?? []).map((r) => ({
      id: r.id,
      title: r.title ?? "New Chat",
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("[chatbot-flow/sessions] GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** POST /api/chatbot-flow/chatbots/[id]/sessions - Create a new chat session */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: chatbotId } = await params;
    if (!chatbotId) {
      return NextResponse.json({ error: "Chatbot id required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const title = typeof (body as { title?: string }).title === "string"
      ? (body as { title: string }).title
      : "New Chat";

    const { data: row, error } = await supabase
      .from("chat_history")
      .insert({
        user_id: session.user.id,
        chatbot_id: chatbotId,
        title,
        messages: [],
      })
      .select("id, title, created_at, updated_at")
      .single();

    if (error) {
      console.error("[chatbot-flow/sessions] create error:", error);
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json({
      session: {
        id: row.id,
        title: row.title ?? "New Chat",
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (err) {
    console.error("[chatbot-flow/sessions] POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

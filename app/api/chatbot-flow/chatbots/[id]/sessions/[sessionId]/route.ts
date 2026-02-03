import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type Params = { params: Promise<{ id: string; sessionId: string }> };

/** GET /api/chatbot-flow/chatbots/[id]/sessions/[sessionId] - Get one session (messages + title) */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: chatbotId, sessionId } = await params;
    if (!chatbotId || !sessionId) {
      return NextResponse.json({ error: "Chatbot id and session id required" }, { status: 400 });
    }

    const { data: row, error } = await supabase
      .from("chat_history")
      .select("id, title, messages, created_at, updated_at")
      .eq("id", sessionId)
      .eq("user_id", session.user.id)
      .eq("chatbot_id", chatbotId)
      .single();

    if (error || !row) {
      if (error?.code === "PGRST116") {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      console.error("[chatbot-flow/sessions/sessionId] get error:", error);
      return NextResponse.json({ error: "Failed to get session" }, { status: 500 });
    }

    const messages = Array.isArray(row.messages) ? row.messages : [];
    return NextResponse.json({
      id: row.id,
      title: row.title ?? "New Chat",
      messages,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  } catch (err) {
    console.error("[chatbot-flow/sessions/sessionId] GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** PATCH /api/chatbot-flow/chatbots/[id]/sessions/[sessionId] - Update title and/or messages */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: chatbotId, sessionId } = await params;
    if (!chatbotId || !sessionId) {
      return NextResponse.json({ error: "Chatbot id and session id required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({})) as { title?: string; messages?: { role: string; content: string }[] };
    const updates: { title?: string; messages?: unknown[]; updated_at?: string } = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.title === "string") updates.title = body.title;
    if (Array.isArray(body.messages)) updates.messages = body.messages;

    const { data: row, error } = await supabase
      .from("chat_history")
      .update(updates)
      .eq("id", sessionId)
      .eq("user_id", session.user.id)
      .eq("chatbot_id", chatbotId)
      .select("id, title, messages, updated_at")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      console.error("[chatbot-flow/sessions/sessionId] patch error:", error);
      return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
    }

    return NextResponse.json({
      id: row.id,
      title: row.title ?? "New Chat",
      messages: Array.isArray(row.messages) ? row.messages : [],
      updated_at: row.updated_at,
    });
  } catch (err) {
    console.error("[chatbot-flow/sessions/sessionId] PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** DELETE /api/chatbot-flow/chatbots/[id]/sessions/[sessionId] */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: chatbotId, sessionId } = await params;
    if (!chatbotId || !sessionId) {
      return NextResponse.json({ error: "Chatbot id and session id required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("chat_history")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", session.user.id)
      .eq("chatbot_id", chatbotId);

    if (error) {
      console.error("[chatbot-flow/sessions/sessionId] delete error:", error);
      return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[chatbot-flow/sessions/sessionId] DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

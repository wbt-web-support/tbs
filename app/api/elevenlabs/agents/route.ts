/**
 * ElevenLabs Agents API - List and Create
 *
 * GET: List all agents
 * POST: Create a new agent
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { DbElevenLabsAgent } from "@/lib/elevenlabs/types";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function verifyAuth() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated", status: 401 };
  }

  // Check if user is super_admin
  const { data: userInfo } = await supabase
    .from("business_info")
    .select("role")
    .eq("user_id", session.user.id)
    .single();

  if (!userInfo || userInfo.role !== "super_admin") {
    return { error: "Unauthorized: Super admin access required", status: 403 };
  }

  return { userId: session.user.id };
}

/**
 * GET /api/elevenlabs/agents
 * List all agents
 */
export async function GET() {
  const auth = await verifyAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const adminClient = getAdminClient();

  const { data: agents, error } = await adminClient
    .from("elevenlabs_agents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[elevenlabs/agents] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }

  // Also fetch tool counts for each agent
  const agentsWithTools = await Promise.all(
    (agents as DbElevenLabsAgent[]).map(async (agent) => {
      const { count } = await adminClient
        .from("elevenlabs_agent_tools")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", agent.id)
        .eq("is_enabled", true);

      return {
        ...agent,
        tool_count: count || 0,
      };
    })
  );

  return NextResponse.json({ agents: agentsWithTools });
}

/**
 * POST /api/elevenlabs/agents
 * Create a new agent
 */
export async function POST(req: Request) {
  const auth = await verifyAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    name: string;
    description?: string;
    voice_id?: string;
    system_prompt?: string;
    first_message?: string;
    tool_keys?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  const adminClient = getAdminClient();

  // Create the agent record
  const { data: agent, error: createError } = await adminClient
    .from("elevenlabs_agents")
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      voice_id: body.voice_id || "EXAVITQu4vr4xnSDxMaL",
      system_prompt: body.system_prompt || "",
      first_message: body.first_message || "Hello, how can I help you today?",
      created_by: auth.userId,
    })
    .select()
    .single();

  if (createError || !agent) {
    console.error("[elevenlabs/agents] POST error:", createError);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }

  // Add tool associations if provided
  if (body.tool_keys && Array.isArray(body.tool_keys) && body.tool_keys.length > 0) {
    const toolInserts = body.tool_keys.map((key) => ({
      agent_id: agent.id,
      tool_key: key,
      is_enabled: true,
    }));

    const { error: toolsError } = await adminClient
      .from("elevenlabs_agent_tools")
      .insert(toolInserts);

    if (toolsError) {
      console.error("[elevenlabs/agents] Tool insert error:", toolsError);
      // Don't fail the whole request, just log the error
    }
  }

  return NextResponse.json({ agent }, { status: 201 });
}

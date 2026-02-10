/**
 * ElevenLabs Agent API - Single Agent Operations
 *
 * GET: Get agent details with tools
 * PATCH: Update agent
 * DELETE: Delete agent
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { deleteAgent as deleteElevenLabsAgent } from "@/lib/elevenlabs/agent-api";

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

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/elevenlabs/agents/[id]
 * Get agent details with tools
 */
export async function GET(req: Request, { params }: RouteParams) {
  const auth = await verifyAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  // Get agent
  const { data: agent, error: agentError } = await adminClient
    .from("elevenlabs_agents")
    .select("*")
    .eq("id", id)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Get agent tools
  const { data: tools } = await adminClient
    .from("elevenlabs_agent_tools")
    .select("tool_key, is_enabled, tool_config")
    .eq("agent_id", id);

  // Get all available tool definitions
  const { data: toolDefinitions } = await adminClient
    .from("elevenlabs_tool_definitions")
    .select("*")
    .eq("is_active", true)
    .order("name");

  return NextResponse.json({
    agent,
    tools: tools || [],
    available_tools: toolDefinitions || [],
  });
}

/**
 * PATCH /api/elevenlabs/agents/[id]
 * Update agent
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  const auth = await verifyAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  let body: {
    name?: string;
    description?: string;
    voice_id?: string;
    system_prompt?: string;
    first_message?: string;
    is_active?: boolean;
    tool_keys?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const adminClient = getAdminClient();

  // Check agent exists
  const { data: existing } = await adminClient
    .from("elevenlabs_agents")
    .select("id")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Build update object
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.voice_id !== undefined) updates.voice_id = body.voice_id;
  if (body.system_prompt !== undefined) updates.system_prompt = body.system_prompt;
  if (body.first_message !== undefined) updates.first_message = body.first_message;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  // Update agent if there are changes
  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await adminClient
      .from("elevenlabs_agents")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      console.error("[elevenlabs/agents] PATCH error:", updateError);
      return NextResponse.json(
        { error: "Failed to update agent" },
        { status: 500 }
      );
    }
  }

  // Update tools if provided
  if (body.tool_keys !== undefined) {
    // Delete existing tools
    await adminClient
      .from("elevenlabs_agent_tools")
      .delete()
      .eq("agent_id", id);

    // Insert new tools
    if (body.tool_keys.length > 0) {
      const toolInserts = body.tool_keys.map((key) => ({
        agent_id: id,
        tool_key: key,
        is_enabled: true,
      }));

      const { error: toolsError } = await adminClient
        .from("elevenlabs_agent_tools")
        .insert(toolInserts);

      if (toolsError) {
        console.error("[elevenlabs/agents] Tool update error:", toolsError);
      }
    }
  }

  // Fetch updated agent
  const { data: agent } = await adminClient
    .from("elevenlabs_agents")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({ agent });
}

/**
 * DELETE /api/elevenlabs/agents/[id]
 * Delete agent
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  const auth = await verifyAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const adminClient = getAdminClient();

  // Get agent to check if it has an ElevenLabs ID
  const { data: agent } = await adminClient
    .from("elevenlabs_agents")
    .select("elevenlabs_agent_id")
    .eq("id", id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Delete from ElevenLabs if synced
  if (agent.elevenlabs_agent_id) {
    try {
      await deleteElevenLabsAgent(agent.elevenlabs_agent_id);
    } catch (error) {
      console.error("[elevenlabs/agents] Failed to delete from ElevenLabs:", error);
      // Continue with local deletion even if ElevenLabs deletion fails
    }
  }

  // Delete from database (tools are cascade deleted)
  const { error: deleteError } = await adminClient
    .from("elevenlabs_agents")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("[elevenlabs/agents] DELETE error:", deleteError);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

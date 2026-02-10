/**
 * ElevenLabs Agent Sync API
 *
 * POST: Sync agent configuration to ElevenLabs
 *
 * This creates or updates the agent in ElevenLabs based on the local configuration.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  createAgent,
  updateAgent,
} from "@/lib/elevenlabs/agent-api";
import type { ToolConfig, DbElevenLabsToolDefinition } from "@/lib/elevenlabs/types";

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
 * POST /api/elevenlabs/agents/[id]/sync
 * Sync agent to ElevenLabs
 */
export async function POST(req: Request, { params }: RouteParams) {
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

  // Get enabled tools for this agent
  const { data: agentTools } = await adminClient
    .from("elevenlabs_agent_tools")
    .select("tool_key")
    .eq("agent_id", id)
    .eq("is_enabled", true);

  const toolKeys = (agentTools || []).map((t) => t.tool_key);

  // Get tool definitions for enabled tools
  const { data: toolDefinitions } = await adminClient
    .from("elevenlabs_tool_definitions")
    .select("*")
    .in("tool_key", toolKeys.length > 0 ? toolKeys : ["__none__"])
    .eq("is_active", true);

  // Build tool configs
  const tools: ToolConfig[] = (
    (toolDefinitions || []) as DbElevenLabsToolDefinition[]
  ).map((def) => ({
    name: def.name,
    description: def.description,
    endpoint: def.endpoint_path,
    parameters: def.parameters_schema,
  }));

  try {
    if (agent.elevenlabs_agent_id) {
      // Update existing agent
      await updateAgent(agent.elevenlabs_agent_id, {
        name: agent.name,
        systemPrompt: agent.system_prompt,
        voiceId: agent.voice_id,
        firstMessage: agent.first_message || undefined,
        tools,
      });

      return NextResponse.json({
        success: true,
        action: "updated",
        elevenlabs_agent_id: agent.elevenlabs_agent_id,
      });
    } else {
      // Create new agent
      const result = await createAgent({
        name: agent.name,
        systemPrompt: agent.system_prompt,
        voiceId: agent.voice_id,
        firstMessage: agent.first_message || undefined,
        tools,
      });

      // Save the ElevenLabs agent ID
      await adminClient
        .from("elevenlabs_agents")
        .update({ elevenlabs_agent_id: result.agent_id })
        .eq("id", id);

      return NextResponse.json({
        success: true,
        action: "created",
        elevenlabs_agent_id: result.agent_id,
      });
    }
  } catch (error) {
    console.error("[elevenlabs/agents/sync] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync agent to ElevenLabs",
      },
      { status: 500 }
    );
  }
}

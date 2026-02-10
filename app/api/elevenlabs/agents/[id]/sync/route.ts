/**
 * ElevenLabs Agent Sync API
 *
 * POST: Sync agent configuration to ElevenLabs
 *
 * Flow:
 * 1. Fetch agent + enabled tools from DB
 * 2. For each tool: create or update as a workspace-level tool in ElevenLabs
 * 3. Collect workspace tool IDs
 * 4. Create or update agent with tool_ids array
 *
 * Tools are managed as workspace resources (not inline) because ElevenLabs
 * silently ignores inline tools on PATCH/update.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  createAgent,
  updateAgent,
  createWorkspaceTool,
  updateWorkspaceTool,
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
 * Ensure a tool definition has a workspace-level tool in ElevenLabs.
 * Creates one if elevenlabs_tool_id is NULL, otherwise updates the existing one.
 * Returns the ElevenLabs tool_id.
 */
async function ensureWorkspaceTool(
  adminClient: ReturnType<typeof getAdminClient>,
  def: DbElevenLabsToolDefinition
): Promise<string> {
  const toolConfig: ToolConfig = {
    name: def.name,
    description: def.description,
    endpoint: def.endpoint_path,
    parameters: def.parameters_schema,
  };

  if (def.elevenlabs_tool_id) {
    // Update existing workspace tool (pushes current URL/schema)
    await updateWorkspaceTool(def.elevenlabs_tool_id, toolConfig);
    return def.elevenlabs_tool_id;
  }

  // Create new workspace tool
  const toolId = await createWorkspaceTool(toolConfig);

  // Save the ElevenLabs tool ID back to DB
  await adminClient
    .from("elevenlabs_tool_definitions")
    .update({ elevenlabs_tool_id: toolId })
    .eq("id", def.id);

  return toolId;
}

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

  const defs = (toolDefinitions || []) as DbElevenLabsToolDefinition[];

  try {
    // Step 1: Ensure each tool exists as a workspace-level tool in ElevenLabs
    const toolIds: string[] = [];
    for (const def of defs) {
      const toolId = await ensureWorkspaceTool(adminClient, def);
      toolIds.push(toolId);
    }

    console.log("[elevenlabs/agents/sync] Workspace tool IDs:", toolIds);

    // Step 2: Create or update the agent with tool_ids
    const agentConfig = {
      name: agent.name,
      systemPrompt: agent.system_prompt,
      voiceId: agent.voice_id,
      firstMessage: agent.first_message || undefined,
      tools: [], // Not used for inline tools anymore
      toolIds,
    };

    if (agent.elevenlabs_agent_id) {
      // Update existing agent
      await updateAgent(agent.elevenlabs_agent_id, agentConfig);

      return NextResponse.json({
        success: true,
        action: "updated",
        elevenlabs_agent_id: agent.elevenlabs_agent_id,
        tool_count: toolIds.length,
      });
    } else {
      // Create new agent
      const result = await createAgent(agentConfig);

      // Save the ElevenLabs agent ID
      await adminClient
        .from("elevenlabs_agents")
        .update({ elevenlabs_agent_id: result.agent_id })
        .eq("id", id);

      return NextResponse.json({
        success: true,
        action: "created",
        elevenlabs_agent_id: result.agent_id,
        tool_count: toolIds.length,
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

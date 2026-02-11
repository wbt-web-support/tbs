/**
 * ElevenLabs Conversational AI Agent API Client
 *
 * Manages creating, updating, and deleting voice agents and workspace tools in ElevenLabs.
 *
 * Tools must be created as workspace-level resources via POST /v1/convai/tools
 * and then referenced by tool_ids on the agent. Inline tools in the agent config
 * only work on CREATE, not PATCH/update.
 */

import type {
  AgentConfig,
  ElevenLabsAgentResponse,
  ElevenLabsError,
  ToolConfig,
} from "./types";

const BASE_URL = "https://api.elevenlabs.io/v1/convai";

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }
  return key;
}

function getToolSecret(): string {
  const secret = process.env.ELEVENLABS_TOOL_SECRET;
  if (!secret) {
    throw new Error("ELEVENLABS_TOOL_SECRET is not configured");
  }
  return secret;
}

function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL is not configured");
  }
  return url;
}

/**
 * Build the tool_config for a single workspace tool
 *
 * Note: ElevenLabs requires:
 * - Tool names must match pattern ^[a-zA-Z0-9_-]{1,64}$ (no spaces)
 * - POST method requires request_body_schema
 * - For dynamic variables, use { type, dynamic_variable } (can't have description with it)
 * - For constants, use { type, constant_value }
 * - For LLM-generated values, use { type, description }
 */
function buildToolConfig(tool: ToolConfig): {
  name: string;
  description: string;
  api_schema: object;
  dynamic_variables?: object;
} {
  const appUrl = getAppUrl();
  const toolSecret = getToolSecret();

  // Sanitize tool name: only alphanumeric, underscore, hyphen allowed
  const toolName = tool.name
    .replace(/[^a-zA-Z0-9\s_-]/g, "") // Remove invalid chars like /
    .replace(/\s+/g, "_")              // Spaces to underscores
    .toLowerCase()
    .substring(0, 64);                 // Max 64 chars

  // Build request body schema with proper ElevenLabs format
  // user_id and team_id use dynamic_variable binding
  // Other params use description for LLM to fill in
  const properties: Record<string, object> = {
    user_id: { type: "string", dynamic_variable: "user_id" },
    team_id: { type: "string", dynamic_variable: "team_id" },
  };

  // Add any additional parameters from the tool config
  if (tool.parameters?.properties) {
    for (const [key, value] of Object.entries(tool.parameters.properties as Record<string, { type?: string; description?: string; enum?: string[] }>)) {
      if (key !== "user_id" && key !== "team_id") {
        // For non-user-context params, let LLM generate them
        if (value.enum) {
          properties[key] = {
            type: value.type || "string",
            description: value.description || `One of: ${value.enum.join(", ")}`
          };
        } else if (value.description) {
          properties[key] = { type: value.type || "string", description: value.description };
        }
      }
    }
  }

  // Special case: web_search needs query param
  if (toolName === "web_search") {
    properties["query"] = { type: "string", description: "Search query" };
    delete properties["user_id"];
    delete properties["team_id"];
  }

  // Workspace tools need their own dynamic_variables declaration
  // for any dynamic_variable bindings used in the request body schema
  const needsDynamicVars = toolName !== "web_search";

  return {
    name: toolName,
    description: tool.description,
    api_schema: {
      url: `${appUrl}${tool.endpoint}`,
      method: "POST",
      request_headers: {
        Authorization: `Bearer ${toolSecret}`,
        "Content-Type": "application/json",
      },
      request_body_schema: {
        type: "object",
        properties,
        ...(toolName === "web_search" && { required: ["query"] }),
      },
    },
    ...(needsDynamicVars && {
      dynamic_variables: {
        dynamic_variable_placeholders: {
          user_id: "test",
          team_id: "test",
        },
      },
    }),
  };
}

// ── Workspace Tool CRUD ─────────────────────────────────────────────

/**
 * Create a workspace-level tool in ElevenLabs
 * Returns the tool_id assigned by ElevenLabs
 */
export async function createWorkspaceTool(tool: ToolConfig): Promise<string> {
  const apiKey = getApiKey();
  const config = buildToolConfig(tool);

  const body = {
    tool_config: {
      type: "webhook",
      ...config,
    },
  };

  console.log("[ElevenLabs] Creating workspace tool:", config.name);

  const response = await fetch(`${BASE_URL}/tools`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("[ElevenLabs] Create tool error:", JSON.stringify(error, null, 2));
    const detail = typeof error.detail === "object"
      ? JSON.stringify(error.detail)
      : error.detail;
    throw new Error(
      `Failed to create ElevenLabs workspace tool: ${detail || error.message || response.statusText}`
    );
  }

  const result = await response.json();
  const toolId = result.tool_id || result.id;
  console.log("[ElevenLabs] Created workspace tool:", toolId);
  return toolId;
}

/**
 * Update an existing workspace-level tool in ElevenLabs
 */
export async function updateWorkspaceTool(toolId: string, tool: ToolConfig): Promise<void> {
  const apiKey = getApiKey();
  const config = buildToolConfig(tool);

  const body = {
    tool_config: {
      type: "webhook",
      ...config,
    },
  };

  console.log("[ElevenLabs] Updating workspace tool:", toolId, config.name);

  const response = await fetch(`${BASE_URL}/tools/${toolId}`, {
    method: "PATCH",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("[ElevenLabs] Update tool error:", JSON.stringify(error, null, 2));
    const detail = typeof error.detail === "object"
      ? JSON.stringify(error.detail)
      : error.detail;
    throw new Error(
      `Failed to update ElevenLabs workspace tool: ${detail || error.message || response.statusText}`
    );
  }
}

/**
 * Delete a workspace-level tool from ElevenLabs
 */
export async function deleteWorkspaceTool(toolId: string): Promise<void> {
  const apiKey = getApiKey();

  console.log("[ElevenLabs] Deleting workspace tool:", toolId);

  const response = await fetch(`${BASE_URL}/tools/${toolId}`, {
    method: "DELETE",
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("[ElevenLabs] Delete tool error:", JSON.stringify(error, null, 2));
    const detail = typeof error.detail === "object"
      ? JSON.stringify(error.detail)
      : error.detail;
    throw new Error(
      `Failed to delete ElevenLabs workspace tool: ${detail || error.message || response.statusText}`
    );
  }
}

/**
 * List all workspace-level tools from ElevenLabs
 */
export async function listWorkspaceTools(): Promise<Array<{ tool_id: string; name: string }>> {
  const apiKey = getApiKey();

  const response = await fetch(`${BASE_URL}/tools`, {
    method: "GET",
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Failed to list ElevenLabs workspace tools: ${error.detail || error.message || response.statusText}`
    );
  }

  const data = await response.json();
  // ElevenLabs returns { tools: [{ id, tool_config: { name, ... } }] }
  return (data.tools || []).map((t: { id: string; tool_config?: { name?: string } }) => ({
    tool_id: t.id,
    name: t.tool_config?.name || "",
  }));
}

// ── Agent CRUD ──────────────────────────────────────────────────────

/**
 * Create a new agent in ElevenLabs
 *
 * Uses tool_ids to reference workspace tools. Includes dynamic_variable_placeholders
 * to initialize user_id/team_id bindings on first create.
 */
export async function createAgent(
  config: AgentConfig
): Promise<ElevenLabsAgentResponse> {
  const apiKey = getApiKey();

  const body = {
    name: config.name,
    conversation_config: {
      agent: {
        prompt: {
          prompt: config.systemPrompt,
          tool_ids: config.toolIds || [],
        },
        first_message: config.firstMessage || "Hello, how can I help you today?",
        language: "en",
        dynamic_variables: {
          dynamic_variable_placeholders: {
            user_id: "test",
            team_id: "test",
            user_name: "test",
          },
        },
      },
      tts: {
        voice_id: config.voiceId,
      },
    },
  };

  const response = await fetch(`${BASE_URL}/agents/create`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error: ElevenLabsError = await response.json().catch(() => ({}));
    console.error("[ElevenLabs] Create agent error:", JSON.stringify(error, null, 2));
    const detail = typeof error.detail === 'object'
      ? JSON.stringify(error.detail)
      : error.detail;
    throw new Error(
      `Failed to create ElevenLabs agent: ${detail || error.message || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Update an existing agent in ElevenLabs
 *
 * Uses tool_ids to reference workspace tools. Includes dynamic_variable_placeholders
 * to preserve the variable bindings (ElevenLabs wipes them if omitted).
 */
export async function updateAgent(
  agentId: string,
  config: AgentConfig
): Promise<void> {
  const apiKey = getApiKey();

  const body = {
    name: config.name,
    conversation_config: {
      agent: {
        prompt: {
          prompt: config.systemPrompt,
          tool_ids: config.toolIds || [],
        },
        first_message: config.firstMessage || "Hello, how can I help you today?",
        language: "en",
        dynamic_variables: {
          dynamic_variable_placeholders: {
            user_id: "test",
            team_id: "test",
            user_name: "test",
          },
        },
      },
      tts: {
        voice_id: config.voiceId,
      },
    },
  };

  console.log("[ElevenLabs] Update agent body:", JSON.stringify(body, null, 2));
  console.log("[ElevenLabs] Tool IDs count:", (config.toolIds || []).length);

  const response = await fetch(`${BASE_URL}/agents/${agentId}`, {
    method: "PATCH",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  console.log("[ElevenLabs] Update response:", response.status, responseText);

  if (!response.ok) {
    let detail: string | undefined;
    try {
      const error = JSON.parse(responseText);
      detail = typeof error.detail === 'object' ? JSON.stringify(error.detail) : error.detail;
    } catch {}
    throw new Error(
      `Failed to update ElevenLabs agent: ${detail || response.statusText}`
    );
  }
}

/**
 * Delete an agent from ElevenLabs
 */
export async function deleteAgent(agentId: string): Promise<void> {
  const apiKey = getApiKey();

  const response = await fetch(`${BASE_URL}/agents/${agentId}`, {
    method: "DELETE",
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const error: ElevenLabsError = await response.json().catch(() => ({}));
    throw new Error(
      `Failed to delete ElevenLabs agent: ${error.detail || error.message || response.statusText}`
    );
  }
}

/**
 * Get an agent from ElevenLabs
 */
export async function getAgent(agentId: string): Promise<ElevenLabsAgentResponse> {
  const apiKey = getApiKey();

  const response = await fetch(`${BASE_URL}/agents/${agentId}`, {
    method: "GET",
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const error: ElevenLabsError = await response.json().catch(() => ({}));
    throw new Error(
      `Failed to get ElevenLabs agent: ${error.detail || error.message || response.statusText}`
    );
  }

  return response.json();
}

/**
 * List available voices from ElevenLabs
 */
export async function listVoices(): Promise<
  Array<{ voice_id: string; name: string }>
> {
  const apiKey = getApiKey();

  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    method: "GET",
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch voices from ElevenLabs");
  }

  const data = await response.json();
  return data.voices.map((v: { voice_id: string; name: string }) => ({
    voice_id: v.voice_id,
    name: v.name,
  }));
}

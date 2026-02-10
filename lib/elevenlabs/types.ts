/**
 * Types for ElevenLabs Voice Agent integration
 */

export type ElevenLabsVoice = {
  voice_id: string;
  name: string;
};

export type ToolConfig = {
  name: string;
  description: string;
  endpoint: string;
  parameters: Record<string, unknown>;
};

export type AgentConfig = {
  name: string;
  systemPrompt: string;
  voiceId: string;
  firstMessage?: string;
  tools: ToolConfig[];
};

export type ElevenLabsAgentResponse = {
  agent_id: string;
  name?: string;
};

export type ElevenLabsError = {
  detail?: string;
  message?: string;
};

// Database types
export type DbElevenLabsAgent = {
  id: string;
  name: string;
  description: string | null;
  elevenlabs_agent_id: string | null;
  voice_id: string;
  system_prompt: string;
  first_message: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DbElevenLabsAgentTool = {
  id: string;
  agent_id: string;
  tool_key: string;
  is_enabled: boolean;
  tool_config: Record<string, unknown>;
  created_at: string;
};

export type DbElevenLabsToolDefinition = {
  id: string;
  tool_key: string;
  name: string;
  description: string;
  endpoint_path: string;
  parameters_schema: Record<string, unknown>;
  supported_scopes: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

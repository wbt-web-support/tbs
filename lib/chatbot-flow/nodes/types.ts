export type NodeDefinition = {
  key: string;
  name: string;
  description?: string;
  nodeType: "data_access" | "instructions" | "sub_agent" | "web_search" | "attachments" | "voice_interface" | "stt_input";
  defaultSettings: Record<string, unknown>;
};

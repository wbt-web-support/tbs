export type NodeDefinition = {
  key: string;
  name: string;
  description?: string;
  nodeType: "data_access" | "instructions" | "sub_agent" | "web_search";
  defaultSettings: Record<string, unknown>;
};

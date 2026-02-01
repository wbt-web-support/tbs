import type { NodeDefinition } from "./types";

export const aiInstructionsNode: NodeDefinition = {
  key: "ai_instructions",
  name: "AI instructions",
  description: "Access AI instructions (creator scope).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "ai_instructions",
    scope: "user_specific",
  },
};

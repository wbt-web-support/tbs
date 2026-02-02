import type { NodeDefinition } from "./types";

export const aiInstructionsNode: NodeDefinition = {
  key: "ai_instructions",
  name: "AI instructions",
  description: "AI instructions (curated prompts and knowledge).\n\nMain fields: title, content, instruction_type, role_access, category, url, is_active, priority.\n\nScope: instructions created by the current user (or platform-wide depending on config).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "ai_instructions",
    scope: "user_specific",
  },
};

import type { NodeDefinition } from "./types";

export const instructionsNode: NodeDefinition = {
  key: "instructions",
  name: "Custom instructions",
  description: "Custom instructions (free-form text).\n\nUse this to add rules, tone, or context that apply only to this chatbot (e.g. “Always be concise”, “Refer to our product as X”). No data fields—just text you write. Priority controls order in the prompt.",
  nodeType: "instructions",
  defaultSettings: {
    content: "",
  },
};

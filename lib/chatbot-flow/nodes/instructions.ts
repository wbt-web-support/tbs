import type { NodeDefinition } from "./types";

export const instructionsNode: NodeDefinition = {
  key: "instructions",
  name: "Custom instructions",
  description: "Add custom text instructions for the chatbot.",
  nodeType: "instructions",
  defaultSettings: {
    content: "",
  },
};

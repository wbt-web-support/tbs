import type { NodeDefinition } from "./types";

export const webSearchNode: NodeDefinition = {
  key: "web_search",
  name: "Web search",
  description:
    "Ground answers in live web data using Gemini’s Google Search.\n\nWhen the user checks \"Search web\" in the chat, the model can fetch current information from the web. Use for product lookups, prices, recent events, and facts that need up-to-date sources. Responses can include citations.",
  nodeType: "web_search",
  defaultSettings: {},
};

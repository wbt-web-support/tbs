import type { NodeDefinition } from "./types";

export const playbooksNode: NodeDefinition = {
  key: "playbooks",
  name: "Playbooks",
  description: "Access playbooks (user scope).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "playbooks",
    scope: "user_specific",
  },
};

import type { NodeDefinition } from "./types";

export const playbooksNode: NodeDefinition = {
  key: "playbooks",
  name: "Playbooks",
  description: "Playbooks (growth, fulfillment, innovation).\n\nMain fields: playbookname, description, enginetype, status, link, department_id, content.\n\nScope: current user only.",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "playbooks",
    scope: "user_specific",
  },
};

import type { NodeDefinition } from "./types";

export const playbookAssignmentsNode: NodeDefinition = {
  key: "playbook_assignments",
  name: "Playbook assignments",
  description: "Access playbook assignments (user scope via business_info).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "playbook_assignments",
    scope: "all",
  },
};

import type { NodeDefinition } from "./types";

export const playbookAssignmentsNode: NodeDefinition = {
  key: "playbook_assignments",
  name: "Playbook assignments",
  description: "Playbook assignments (who owns or is related to which playbook).\n\nMain fields: user_id, playbook_id, assignment_type (Owner/Related).\n\nScope: platform-wide; links business_info users to playbooks.",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "playbook_assignments",
    scope: "all",
  },
};

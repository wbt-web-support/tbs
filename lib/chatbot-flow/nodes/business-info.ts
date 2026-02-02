import type { NodeDefinition } from "./types";

export const businessInfoNode: NodeDefinition = {
  key: "business_info",
  name: "Business info",
  description: "Team and member profiles.\n\nMain fields: full_name, business_name, email, phone_number, role, job_title, manager, department, critical_accountabilities, playbooks_owned, team_id, manager_id, department_id, profile_picture_url, permissions.\n\nScope: team (all members) or current user only.",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "business_info",
    scope: "team_specific",
  },
};

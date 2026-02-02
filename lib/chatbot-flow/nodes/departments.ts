import type { NodeDefinition } from "./types";

export const departmentsNode: NodeDefinition = {
  key: "departments",
  name: "Departments",
  description: "Departments list.\n\nMain fields: id, name, team_id.\n\nScope: team only (departments for the user's business).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "departments",
    scope: "team_specific",
  },
};

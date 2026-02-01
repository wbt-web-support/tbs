import type { NodeDefinition } from "./types";

export const departmentsNode: NodeDefinition = {
  key: "departments",
  name: "Departments",
  description: "Access departments (team scope).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "departments",
    scope: "team_specific",
  },
};

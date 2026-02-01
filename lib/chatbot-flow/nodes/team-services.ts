import type { NodeDefinition } from "./types";

export const teamServicesNode: NodeDefinition = {
  key: "team_services",
  name: "Team services",
  description: "Access team services (team scope).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "team_services",
    scope: "team_specific",
  },
};

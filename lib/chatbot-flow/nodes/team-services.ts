import type { NodeDefinition } from "./types";

export const teamServicesNode: NodeDefinition = {
  key: "team_services",
  name: "Team services",
  description: "Which global services are enabled for the team.\n\nMain fields: team_id, service_id (links to global_services).\n\nScope: team only.",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "team_services",
    scope: "team_specific",
  },
};

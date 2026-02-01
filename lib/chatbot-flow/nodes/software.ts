import type { NodeDefinition } from "./types";

export const softwareNode: NodeDefinition = {
  key: "software",
  name: "Software",
  description: "Access software catalog (team scope).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "software",
    scope: "team_specific",
  },
};

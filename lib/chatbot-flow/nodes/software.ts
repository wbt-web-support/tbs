import type { NodeDefinition } from "./types";

export const softwareNode: NodeDefinition = {
  key: "software",
  name: "Software",
  description: "Software catalog for the team.\n\nMain fields: software, url, description, price_monthly, pricing_period, department_id, team_id.\n\nScope: team only.",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "software",
    scope: "team_specific",
  },
};

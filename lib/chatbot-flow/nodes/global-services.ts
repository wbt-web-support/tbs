import type { NodeDefinition } from "./types";

export const globalServicesNode: NodeDefinition = {
  key: "global_services",
  name: "Global services",
  description: "Global services catalog (shared across all accounts).\n\nMain fields: service_name, description, category, is_active, display_order.\n\nScope: platform-wide; no team/user filter.",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "global_services",
    scope: "all",
  },
};

import type { NodeDefinition } from "./types";

export const globalServicesNode: NodeDefinition = {
  key: "global_services",
  name: "Global services",
  description: "Access global services catalog (platform-wide).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "global_services",
    scope: "all",
  },
};

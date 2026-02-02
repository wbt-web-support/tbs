import type { NodeDefinition } from "./types";

export const sopDataNode: NodeDefinition = {
  key: "sop_data",
  name: "SOP data",
  description: "Standard operating procedures (SOPs).\n\nMain fields: title, content, version, is_current, metadata.\n\nScope: current user only.",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "sop_data",
    scope: "user_specific",
  },
};

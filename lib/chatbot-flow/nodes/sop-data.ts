import type { NodeDefinition } from "./types";

export const sopDataNode: NodeDefinition = {
  key: "sop_data",
  name: "SOP data",
  description: "Access standard operating procedures (user scope).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "sop_data",
    scope: "user_specific",
  },
};

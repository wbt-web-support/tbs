import type { NodeDefinition } from "./types";

export const leaveEntitlementsNode: NodeDefinition = {
  key: "leave_entitlements",
  name: "Leave entitlements",
  description: "Access leave entitlements (team scope).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "leave_entitlements",
    scope: "team_specific",
  },
};

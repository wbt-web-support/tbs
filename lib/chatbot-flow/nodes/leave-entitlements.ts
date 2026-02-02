import type { NodeDefinition } from "./types";

export const leaveEntitlementsNode: NodeDefinition = {
  key: "leave_entitlements",
  name: "Leave entitlements",
  description: "Leave entitlement policy per team.\n\nMain fields: team_id, total_entitlement_days, year.\n\nScope: team only (entitlements for the user's business).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "leave_entitlements",
    scope: "team_specific",
  },
};

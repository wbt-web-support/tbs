import type { NodeDefinition } from "./types";

export const leaveApprovalsNode: NodeDefinition = {
  key: "leave_approvals",
  name: "Leave approvals",
  description: "Access leave approvals (approver scope).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "leave_approvals",
    scope: "user_specific",
  },
};

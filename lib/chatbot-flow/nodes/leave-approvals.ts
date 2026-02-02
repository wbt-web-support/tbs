import type { NodeDefinition } from "./types";

export const leaveApprovalsNode: NodeDefinition = {
  key: "leave_approvals",
  name: "Leave approvals",
  description: "Leave approval actions (for requests the user approved/rejected).\n\nMain fields: leave_id, approver_id, action (approved/rejected), comments.\n\nScope: current user as approver (leave requests they acted on).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "leave_approvals",
    scope: "user_specific",
  },
};

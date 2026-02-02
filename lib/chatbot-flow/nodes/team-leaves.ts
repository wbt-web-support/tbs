import type { NodeDefinition } from "./types";

export const teamLeavesNode: NodeDefinition = {
  key: "team_leaves",
  name: "Team leaves",
  description: "Leave requests (time off).\n\nMain fields: leave_type, start_date, end_date, status, duration_days, description.\n\nScope: current user's leave requests only.",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "team_leaves",
    scope: "user_specific",
  },
};

import type { NodeDefinition } from "./types";

export const teamLeavesNode: NodeDefinition = {
  key: "team_leaves",
  name: "Team leaves",
  description: "Access team leave requests (user scope).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "team_leaves",
    scope: "user_specific",
  },
};

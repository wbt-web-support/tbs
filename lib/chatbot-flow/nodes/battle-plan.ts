import type { NodeDefinition } from "./types";

export const battlePlanNode: NodeDefinition = {
  key: "battle_plan",
  name: "Battle plan",
  description: "Access battle plan (user scope).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "battle_plan",
    scope: "user_specific",
  },
};

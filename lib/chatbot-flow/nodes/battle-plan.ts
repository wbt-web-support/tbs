import type { NodeDefinition } from "./types";

export const battlePlanNode: NodeDefinition = {
  key: "battle_plan",
  name: "Battle plan",
  description: "Battle plan / business plan content.\n\nMain fields: missionstatement, visionstatement, purposewhy, strategicanchors, corevalues, business_plan_content, oneyeartarget, fiveyeartarget, tenyeartarget, static_questions_answers, businessplanlink.\n\nScope: current user only.",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "battle_plan",
    scope: "user_specific",
  },
};

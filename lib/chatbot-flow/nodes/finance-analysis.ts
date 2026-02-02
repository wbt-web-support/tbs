import type { NodeDefinition } from "./types";

export const financeAnalysisNode: NodeDefinition = {
  key: "finance_analysis",
  name: "Finance analysis",
  description: "Finance analysis results from uploaded files.\n\nMain fields: file_id, analysis_result, summary, status, period_type, user_id, team_id.\n\nScope: team or current user.",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "finance_analysis",
    scope: "team_specific",
  },
};

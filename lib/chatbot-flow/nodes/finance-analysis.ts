import type { NodeDefinition } from "./types";

export const financeAnalysisNode: NodeDefinition = {
  key: "finance_analysis",
  name: "Finance analysis",
  description: "Access finance analysis results (team or user scope).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "finance_analysis",
    scope: "team_specific",
  },
};

import type { NodeDefinition } from "./types";

export const performanceKpisNode: NodeDefinition = {
  key: "performance_kpis",
  name: "Performance KPIs",
  description: "Access performance KPIs (session-based).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "performance_kpis",
    scope: "all",
  },
};

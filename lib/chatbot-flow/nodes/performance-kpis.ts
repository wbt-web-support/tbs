import type { NodeDefinition } from "./types";

export const performanceKpisNode: NodeDefinition = {
  key: "performance_kpis",
  name: "Performance KPIs",
  description: "Performance KPIs (session-based metrics).\n\nMain fields: session_id, revenue, revenue_status, ad_spend, leads, jobs_completed, roas, roi_pounds, roi_percent, google_reviews.\n\nScope: platform-wide (session-based; filter by context when available).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "performance_kpis",
    scope: "all",
  },
};

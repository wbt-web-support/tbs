import type { NodeDefinition } from "./types";

export const companyOnboardingNode: NodeDefinition = {
  key: "company_onboarding",
  name: "Company onboarding",
  description: "Company onboarding and competitor data.\n\nMain fields: onboarding_data (JSON), completed, competitor_data, user_id.\n\nScope: current user only.",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "company_onboarding",
    scope: "user_specific",
  },
};

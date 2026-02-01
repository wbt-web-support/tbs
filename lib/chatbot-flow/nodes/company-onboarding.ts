import type { NodeDefinition } from "./types";

export const companyOnboardingNode: NodeDefinition = {
  key: "company_onboarding",
  name: "Company onboarding",
  description: "Access company onboarding data (user scope).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "company_onboarding",
    scope: "user_specific",
  },
};

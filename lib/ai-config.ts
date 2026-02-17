/** Config keys for each AI feature. Add new keys here when adding new pages (e.g. machines). */
export const AI_CONFIG_KEYS = {
  openrouter_business_plan_model: "openrouter_business_plan_model",
  openrouter_machines_model: "openrouter_machines_model",
} as const;

export type AiConfigKey = keyof typeof AI_CONFIG_KEYS;

/** Which model config key is used when running this prompt (prompt_key from prompts table). */
export const PROMPT_KEY_TO_MODEL_CONFIG: Partial<Record<string, AiConfigKey>> = {
  business_plan: "openrouter_business_plan_model",
  business_plan_questions: "openrouter_business_plan_model",
  // Add more as needed: e.g. growth_machine: "openrouter_machines_model",
};

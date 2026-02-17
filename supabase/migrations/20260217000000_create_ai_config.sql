-- AI config: key/value store for OpenRouter and other AI provider settings
CREATE TABLE IF NOT EXISTS public.ai_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Default model for business plan generation (admin can change in AI Config)
INSERT INTO public.ai_config (key, value, updated_at)
VALUES ('openrouter_business_plan_model', 'openai/gpt-4o', now())
ON CONFLICT (key) DO NOTHING;

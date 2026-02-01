-- Convert chatbots.base_prompt (text) to base_prompts (jsonb array of { type, content })
-- Format: base_prompts = [ { "type": "text", "content": "..." }, ... ]

ALTER TABLE public.chatbots
  ADD COLUMN IF NOT EXISTS base_prompts jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Migrate existing base_prompt into base_prompts
UPDATE public.chatbots
SET base_prompts = jsonb_build_array(
  jsonb_build_object('type', 'text', 'content', COALESCE(NULLIF(TRIM(base_prompt), ''), ''))
)
WHERE base_prompt IS NOT NULL AND TRIM(base_prompt) <> '';

-- For rows that had empty base_prompt, ensure empty array
UPDATE public.chatbots
SET base_prompts = '[]'::jsonb
WHERE base_prompts IS NULL OR base_prompts = 'null'::jsonb;

-- Drop old column
ALTER TABLE public.chatbots
  DROP COLUMN IF EXISTS base_prompt;

-- Ensure default for new rows
ALTER TABLE public.chatbots
  ALTER COLUMN base_prompts SET DEFAULT '[]'::jsonb;

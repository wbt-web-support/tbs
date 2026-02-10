ALTER TABLE public.elevenlabs_tool_definitions
  ADD COLUMN IF NOT EXISTS elevenlabs_tool_id text;


-- Add single JSONB column: { "questions": [...], "answers": { "id": "value", ... } }
ALTER TABLE public.battle_plan ADD COLUMN IF NOT EXISTS static_questions_answers jsonb DEFAULT '{"questions":[],"answers":{}}';

COMMENT ON COLUMN public.battle_plan.static_questions_answers IS 'Static business plan questions (definitions) and answers; same structure as machines.questions + machines.answers';

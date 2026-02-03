-- Add chatbot_id to chat_history so we can store chat sessions per chatbot (chatbot-flow).
-- Rows with chatbot_id IS NULL remain legacy gemini/innovation instances.

ALTER TABLE public.chat_history
ADD COLUMN IF NOT EXISTS chatbot_id uuid REFERENCES public.chatbots(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chat_history_user_chatbot_created
ON public.chat_history (user_id, chatbot_id, created_at DESC);

COMMENT ON COLUMN public.chat_history.chatbot_id IS 'When set, this row is a chatbot-flow session for that chatbot. When NULL, legacy gemini instance.';

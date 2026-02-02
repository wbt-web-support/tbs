-- Drop tables for removed features: member dashboard, old chat, zapier-mappings, admin ai-instructions, admin instructions.
-- Chatbot flow is unchanged (uses /ai and chatbot_flow tables only).

-- ai_instructions: used by removed admin/ai-instructions; flow no longer has ai_instructions node.
DROP FUNCTION IF EXISTS match_ai_instructions(vector, double precision, integer, text);
DROP TABLE IF EXISTS public.ai_instructions CASCADE;

-- zapier_mappings and zapier_webhooks: used by removed (dashboard)/zapier-mappings.
DROP TABLE IF EXISTS public.zapier_mappings CASCADE;
DROP TABLE IF EXISTS public.zapier_webhooks CASCADE;

-- chatbot_instructions: used by removed admin/instructions. embedding_queue references it.
DROP TABLE IF EXISTS public.embedding_queue CASCADE;
DROP FUNCTION IF EXISTS match_chatbot_instructions(vector, double precision, integer);
DROP FUNCTION IF EXISTS match_chatbot_instructions(vector, double precision, integer, text);
DROP TABLE IF EXISTS public.chatbot_instructions CASCADE;

-- innovation_*: used by removed innovation-chat / innovation-documents / innovation-training-data.
DROP TABLE IF EXISTS public.innovation_chat_training_data CASCADE;
DROP TABLE IF EXISTS public.innovation_chat_history CASCADE;
DROP TABLE IF EXISTS public.innovation_documents CASCADE;

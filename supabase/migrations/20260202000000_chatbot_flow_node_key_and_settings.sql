-- Chatbot Flow: support hardcoded nodes via node_key + per-link settings
-- Links can reference a node by node_key (string) instead of node_id (uuid).
-- node_id is kept nullable for backward compatibility with existing links.

-- Add new columns to chatbot_flow_node_links
ALTER TABLE public.chatbot_flow_node_links
  ADD COLUMN IF NOT EXISTS node_key text,
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';

-- Allow node_id to be null so new links use only node_key
ALTER TABLE public.chatbot_flow_node_links
  ALTER COLUMN node_id DROP NOT NULL;

-- Uniqueness: one link per (chatbot_id, node_key) when node_key is set
CREATE UNIQUE INDEX IF NOT EXISTS idx_chatbot_flow_node_links_chatbot_node_key
  ON public.chatbot_flow_node_links(chatbot_id, node_key)
  WHERE node_key IS NOT NULL;

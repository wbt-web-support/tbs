-- Drop old node library: nodes are now hardcoded (node_key on links only).

-- Remove legacy links that still use node_id (no node_key)
DELETE FROM public.chatbot_flow_node_links
WHERE node_key IS NULL;

-- Drop FK and column from links
ALTER TABLE public.chatbot_flow_node_links
  DROP COLUMN IF EXISTS node_id;

-- Require node_key on every link
ALTER TABLE public.chatbot_flow_node_links
  ALTER COLUMN node_key SET NOT NULL;

-- Drop the old node library table (RLS and trigger go with it)
DROP TABLE IF EXISTS public.chatbot_flow_nodes;

-- Chatbot Flow: chatbots, nodes, and junction table (superadmin-only)
-- Reference: chatbot-docs implementation plan Phase 1.1

-- Table: chatbots
CREATE TABLE IF NOT EXISTS public.chatbots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  base_prompt text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  model_name text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table: chatbot_flow_nodes (node library)
CREATE TABLE IF NOT EXISTS public.chatbot_flow_nodes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  node_type text NOT NULL CHECK (node_type IN ('data_access', 'instructions', 'sub_agent', 'web_search')),
  settings jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_flow_nodes_node_type ON public.chatbot_flow_nodes(node_type);

-- Table: chatbot_flow_node_links (junction: which nodes are attached to which chatbot, in order)
CREATE TABLE IF NOT EXISTS public.chatbot_flow_node_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chatbot_id uuid NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES public.chatbot_flow_nodes(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(chatbot_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_chatbot_flow_node_links_chatbot_order ON public.chatbot_flow_node_links(chatbot_id, order_index);

-- RLS: superadmin-only for all three tables
ALTER TABLE public.chatbots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_flow_node_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage chatbots" ON public.chatbots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
  );

CREATE POLICY "Superadmins can manage chatbot_flow_nodes" ON public.chatbot_flow_nodes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
  );

CREATE POLICY "Superadmins can manage chatbot_flow_node_links" ON public.chatbot_flow_node_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
  );

-- Trigger to update updated_at on chatbots and chatbot_flow_nodes
CREATE OR REPLACE FUNCTION public.update_chatbot_flow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chatbots_updated_at
  BEFORE UPDATE ON public.chatbots
  FOR EACH ROW EXECUTE FUNCTION public.update_chatbot_flow_updated_at();

CREATE TRIGGER chatbot_flow_nodes_updated_at
  BEFORE UPDATE ON public.chatbot_flow_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_chatbot_flow_updated_at();

-- Migration: Create ElevenLabs Voice Agent tables
-- This adds tables for managing ElevenLabs voice agents and their tool access
-- Existing chatbot tables (chatbots, chatbot_flow_node_links) are preserved

-- Table: elevenlabs_agents
-- Stores configuration for ElevenLabs voice agents
CREATE TABLE IF NOT EXISTS public.elevenlabs_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  elevenlabs_agent_id text,  -- ID from ElevenLabs API (null until synced)
  voice_id text NOT NULL DEFAULT 'EXAVITQu4vr4xnSDxMaL',  -- Default: Bella
  system_prompt text NOT NULL DEFAULT '',
  first_message text DEFAULT 'Hello, how can I help you today?',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table: elevenlabs_agent_tools
-- Junction table: which tools each agent has access to
CREATE TABLE IF NOT EXISTS public.elevenlabs_agent_tools (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.elevenlabs_agents(id) ON DELETE CASCADE,
  tool_key text NOT NULL,  -- e.g., "tasks", "business_info", "web_search"
  is_enabled boolean NOT NULL DEFAULT true,
  tool_config jsonb NOT NULL DEFAULT '{}',  -- tool-specific settings (e.g., default scope)
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(agent_id, tool_key)
);

-- Table: elevenlabs_tool_definitions
-- Master list of available tools with their schemas
CREATE TABLE IF NOT EXISTS public.elevenlabs_tool_definitions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  endpoint_path text NOT NULL,  -- e.g., "/api/v2/agent-tools/tasks"
  parameters_schema jsonb NOT NULL,  -- ElevenLabs tool schema
  supported_scopes text[] NOT NULL DEFAULT ARRAY['user_specific', 'team_specific', 'all'],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_elevenlabs_agents_is_active ON public.elevenlabs_agents(is_active);
CREATE INDEX IF NOT EXISTS idx_elevenlabs_agents_created_by ON public.elevenlabs_agents(created_by);
CREATE INDEX IF NOT EXISTS idx_elevenlabs_agent_tools_agent_id ON public.elevenlabs_agent_tools(agent_id);
CREATE INDEX IF NOT EXISTS idx_elevenlabs_agent_tools_tool_key ON public.elevenlabs_agent_tools(tool_key);

-- Enable RLS
ALTER TABLE public.elevenlabs_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elevenlabs_agent_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elevenlabs_tool_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for elevenlabs_agents
-- Superadmins can do everything
CREATE POLICY "Superadmins can manage elevenlabs_agents" ON public.elevenlabs_agents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
  );

-- Authenticated users can view active agents
CREATE POLICY "Authenticated users can view active agents" ON public.elevenlabs_agents
  FOR SELECT USING (
    auth.role() = 'authenticated' AND is_active = true
  );

-- RLS Policies for elevenlabs_agent_tools
CREATE POLICY "Superadmins can manage elevenlabs_agent_tools" ON public.elevenlabs_agent_tools
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
  );

CREATE POLICY "Authenticated users can view agent tools" ON public.elevenlabs_agent_tools
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- RLS Policies for elevenlabs_tool_definitions
CREATE POLICY "Superadmins can manage tool definitions" ON public.elevenlabs_tool_definitions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
  );

CREATE POLICY "Authenticated users can view tool definitions" ON public.elevenlabs_tool_definitions
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- Trigger for updated_at on elevenlabs_agents
CREATE OR REPLACE FUNCTION update_elevenlabs_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER elevenlabs_agents_updated_at
  BEFORE UPDATE ON public.elevenlabs_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_elevenlabs_agents_updated_at();

-- Trigger for updated_at on elevenlabs_tool_definitions
CREATE OR REPLACE FUNCTION update_elevenlabs_tool_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER elevenlabs_tool_definitions_updated_at
  BEFORE UPDATE ON public.elevenlabs_tool_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_elevenlabs_tool_definitions_updated_at();

-- Seed initial tool definitions
INSERT INTO public.elevenlabs_tool_definitions (tool_key, name, description, endpoint_path, parameters_schema, supported_scopes) VALUES
  ('business_info', 'Business Info', 'Get team member profiles, roles, departments, and contact information', '/api/v2/agent-tools/business-info', '{"type": "object", "properties": {"scope": {"type": "string", "enum": ["user_specific", "team_specific"], "description": "Scope of data to fetch"}}}', ARRAY['user_specific', 'team_specific']),
  ('tasks', 'Tasks', 'Get tasks with priority, status, and due dates', '/api/v2/agent-tools/tasks', '{"type": "object", "properties": {"scope": {"type": "string", "enum": ["user_specific", "team_specific"]}, "status": {"type": "string", "description": "Filter by task status"}}}', ARRAY['user_specific', 'team_specific']),
  ('google_calendar_events', 'Calendar Events', 'Get upcoming calendar events and schedule', '/api/v2/agent-tools/calendar-events', '{"type": "object", "properties": {"days_ahead": {"type": "number", "description": "Number of days to look ahead"}}}', ARRAY['user_specific']),
  ('battle_plan', 'Battle Plan', 'Get strategic goals, vision, mission, and business plan', '/api/v2/agent-tools/battle-plan', '{"type": "object", "properties": {}}', ARRAY['user_specific']),
  ('playbooks', 'Playbooks', 'Get playbook procedures and documentation', '/api/v2/agent-tools/playbooks', '{"type": "object", "properties": {}}', ARRAY['user_specific']),
  ('machines', 'Machines / Value Engines', 'Get value engines and automation workflows', '/api/v2/agent-tools/machines', '{"type": "object", "properties": {}}', ARRAY['user_specific']),
  ('sop_data', 'SOP Data', 'Get standard operating procedures', '/api/v2/agent-tools/sop-data', '{"type": "object", "properties": {}}', ARRAY['user_specific']),
  ('team_leaves', 'Team Leaves', 'Get leave requests and time off information', '/api/v2/agent-tools/team-leaves', '{"type": "object", "properties": {}}', ARRAY['user_specific']),
  ('leave_approvals', 'Leave Approvals', 'Get leave approval history', '/api/v2/agent-tools/leave-approvals', '{"type": "object", "properties": {}}', ARRAY['user_specific']),
  ('leave_entitlements', 'Leave Entitlements', 'Get annual leave allowances and entitlements', '/api/v2/agent-tools/leave-entitlements', '{"type": "object", "properties": {}}', ARRAY['team_specific']),
  ('departments', 'Departments', 'Get department listing and structure', '/api/v2/agent-tools/departments', '{"type": "object", "properties": {}}', ARRAY['team_specific']),
  ('software', 'Software', 'Get software and tools used by the team', '/api/v2/agent-tools/software', '{"type": "object", "properties": {}}', ARRAY['team_specific']),
  ('finance_analysis', 'Finance Analysis', 'Get financial metrics and analysis summaries', '/api/v2/agent-tools/finance-analysis', '{"type": "object", "properties": {"scope": {"type": "string", "enum": ["user_specific", "team_specific"]}}}', ARRAY['user_specific', 'team_specific']),
  ('company_onboarding', 'Company Onboarding', 'Get onboarding data and competitor information', '/api/v2/agent-tools/company-onboarding', '{"type": "object", "properties": {}}', ARRAY['user_specific']),
  ('business_owner_instructions', 'Business Owner Instructions', 'Get curated instructions and guidelines', '/api/v2/agent-tools/business-owner-instructions', '{"type": "object", "properties": {}}', ARRAY['user_specific']),
  ('global_services', 'Global Services', 'Get company-wide services catalog', '/api/v2/agent-tools/global-services', '{"type": "object", "properties": {}}', ARRAY['all']),
  ('team_services', 'Team Services', 'Get services enabled for the team', '/api/v2/agent-tools/team-services', '{"type": "object", "properties": {}}', ARRAY['team_specific']),
  ('performance_kpis', 'Performance KPIs', 'Get performance metrics and KPIs', '/api/v2/agent-tools/performance-kpis', '{"type": "object", "properties": {}}', ARRAY['all']),
  ('playbook_assignments', 'Playbook Assignments', 'Get playbook ownership assignments', '/api/v2/agent-tools/playbook-assignments', '{"type": "object", "properties": {}}', ARRAY['all']),
  ('web_search', 'Web Search', 'Search the internet for information', '/api/v2/agent-tools/web-search', '{"type": "object", "properties": {"query": {"type": "string", "description": "Search query"}, "max_results": {"type": "number", "description": "Maximum number of results"}}, "required": ["query"]}', ARRAY['all'])
ON CONFLICT (tool_key) DO NOTHING;

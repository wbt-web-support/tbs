-- Add mermaid_diagram column to machines for AI-generated/editable Mermaid flowchart code
ALTER TABLE public.machines
ADD COLUMN IF NOT EXISTS mermaid_diagram TEXT;

COMMENT ON COLUMN public.machines.mermaid_diagram IS 'Mermaid flowchart code for machine design diagram (generated from actions/activities or edited by user)';

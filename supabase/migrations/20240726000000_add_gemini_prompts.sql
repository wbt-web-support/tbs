-- Add Gemini prompts for various modules to the prompts table

-- Business Plan Prompt
INSERT INTO public.prompts (prompt_key, description, prompt_text) 
VALUES (
  'business_plan',
  'AI prompt for generating a comprehensive business plan based on company context',
  'All responses should use UK English grammar.

You are an expert business consultant specializing in creating comprehensive business plans for companies.

Based on the company context provided, generate a detailed business plan that will help the organization achieve their goals.

{{companyContext}}

{{responseFormat}}'
)
ON CONFLICT (prompt_key) DO UPDATE SET
  description = EXCLUDED.description,
  prompt_text = EXCLUDED.prompt_text,
  updated_at = NOW();

-- Company Overview Prompt
INSERT INTO public.prompts (prompt_key, description, prompt_text) 
VALUES (
  'company_overview',
  'AI prompt for generating a company overview based on company context',
  'All responses should use UK English grammar.

You are an expert business analyst specializing in generating concise yet comprehensive company overviews.

Based on the company context provided, generate a detailed company overview that captures the essence of the business.

{{companyContext}}

{{responseFormat}}'
)
ON CONFLICT (prompt_key) DO UPDATE SET
  description = EXCLUDED.description,
  prompt_text = EXCLUDED.prompt_text,
  updated_at = NOW();

-- Fulfillment Machine Prompt
INSERT INTO public.prompts (prompt_key, description, prompt_text) 
VALUES (
  'fulfillment_machine',
  'AI prompt for generating a fulfillment machine process based on company context',
  'All responses should use UK English grammar.

You are an expert business process consultant specializing in creating efficient fulfillment machines.

Based on the company context provided, generate a detailed fulfillment machine process that outlines the key steps, triggering events, and ending events.

{{companyContext}}

{{responseFormat}}'
)
ON CONFLICT (prompt_key) DO UPDATE SET
  description = EXCLUDED.description,
  prompt_text = EXCLUDED.prompt_text,
  updated_at = NOW();

-- Growth Machine Prompt
INSERT INTO public.prompts (prompt_key, description, prompt_text) 
VALUES (
  'growth_machine',
  'AI prompt for generating a growth machine process based on company context',
  'All responses should use UK English grammar.

You are an expert business strategist specializing in creating effective growth machines.

Based on the company context provided, generate a detailed growth machine process that outlines the key steps, triggering events, and ending events.

{{companyContext}}

{{responseFormat}}'
)
ON CONFLICT (prompt_key) DO UPDATE SET
  description = EXCLUDED.description,
  prompt_text = EXCLUDED.prompt_text,
  updated_at = NOW(); 
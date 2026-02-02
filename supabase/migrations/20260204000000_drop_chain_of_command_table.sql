-- Drop legacy chain_of_command table.
-- Chain-of-command data lives in business_info (job_title, manager, critical_accountabilities, department, etc.)
-- after migration 20250202000000_add_chain_of_command_to_business_info.sql.

DROP TABLE IF EXISTS public.chain_of_command;

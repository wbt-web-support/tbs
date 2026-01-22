-- Migrate existing machines to use services
-- This migration is now handled by the global_services migration
-- It will create a "Default Service" in global_services and link machines to it
-- This migration is kept for reference but the actual migration happens in 20260122000005

-- Note: This migration is now handled in the team_services_junction migration
-- which creates global_services and links machines to them

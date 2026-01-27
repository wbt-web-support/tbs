-- Migration script to handle existing machines
-- Creates default subcategories for existing services and links existing machines to them

-- Step 1: Create default subcategories for each service that teams have selected
-- For each team-service combination, create a "General [Service Name]" subcategory
DO $$
DECLARE
  team_service_record RECORD;
  default_subcategory_id UUID;
BEGIN
  -- Loop through all team-service combinations
  FOR team_service_record IN 
    SELECT DISTINCT ts.team_id, ts.service_id, gs.service_name
    FROM team_services ts
    JOIN global_services gs ON ts.service_id = gs.id
    WHERE NOT EXISTS (
      -- Only create if subcategory doesn't already exist
      SELECT 1 FROM service_subcategories ss
      WHERE ss.team_id = ts.team_id 
        AND ss.service_id = ts.service_id
        AND ss.subcategory_name = 'General ' || gs.service_name
    )
  LOOP
    -- Create default subcategory
    INSERT INTO service_subcategories (
      team_id,
      service_id,
      subcategory_name,
      description,
      ai_generated
    ) VALUES (
      team_service_record.team_id,
      team_service_record.service_id,
      'General ' || team_service_record.service_name,
      'Default subcategory for ' || team_service_record.service_name || ' service',
      false
    )
    ON CONFLICT (team_id, service_id, subcategory_name) DO NOTHING
    RETURNING id INTO default_subcategory_id;
    
    RAISE NOTICE 'Created default subcategory for team: %, service: %', 
      team_service_record.team_id, team_service_record.service_name;
  END LOOP;
END $$;

-- Step 2: Link existing machines to default subcategories
-- For machines with service_id but no subcategory_id, find the default subcategory and link it
UPDATE machines m
SET subcategory_id = ss.id
FROM service_subcategories ss
WHERE m.service_id = ss.service_id
  AND m.user_id = ss.team_id
  AND ss.subcategory_name = 'General ' || (
    SELECT service_name FROM global_services WHERE id = m.service_id
  )
  AND m.subcategory_id IS NULL
  AND m.service_id IS NOT NULL;

-- Step 3: For machines without service_id, create a "General Default Service" subcategory
-- First, ensure the default service exists
INSERT INTO global_services (service_name, category, is_active)
VALUES ('Default Service', 'General', true)
ON CONFLICT (service_name) DO NOTHING;

-- Create default subcategory for teams with machines but no service
DO $$
DECLARE
  machine_record RECORD;
  default_service_id UUID;
  default_subcategory_id UUID;
BEGIN
  -- Get the default service ID
  SELECT id INTO default_service_id
  FROM global_services
  WHERE service_name = 'Default Service'
  LIMIT 1;
  
  IF default_service_id IS NULL THEN
    RAISE EXCEPTION 'Default Service not found';
  END IF;
  
  -- For each team with machines but no service_id/subcategory_id
  FOR machine_record IN 
    SELECT DISTINCT m.user_id as team_id
    FROM machines m
    WHERE m.service_id IS NULL
      AND m.subcategory_id IS NULL
      AND m.enginetype IN ('GROWTH', 'FULFILLMENT')
  LOOP
    -- Create default subcategory for this team if it doesn't exist
    INSERT INTO service_subcategories (
      team_id,
      service_id,
      subcategory_name,
      description,
      ai_generated
    ) VALUES (
      machine_record.team_id,
      default_service_id,
      'General Default Service',
      'Default subcategory for machines without a specific service',
      false
    )
    ON CONFLICT (team_id, service_id, subcategory_name) DO NOTHING
    RETURNING id INTO default_subcategory_id;
    
    -- Link machines to this default subcategory
    UPDATE machines
    SET subcategory_id = default_subcategory_id
    WHERE user_id = machine_record.team_id
      AND service_id IS NULL
      AND subcategory_id IS NULL;
    
    RAISE NOTICE 'Created default subcategory and linked machines for team: %', 
      machine_record.team_id;
  END LOOP;
END $$;

-- Step 4: Verify migration
-- Count machines with subcategory_id
DO $$
DECLARE
  machines_with_subcategory INTEGER;
  machines_without_subcategory INTEGER;
BEGIN
  SELECT COUNT(*) INTO machines_with_subcategory
  FROM machines
  WHERE subcategory_id IS NOT NULL;
  
  SELECT COUNT(*) INTO machines_without_subcategory
  FROM machines
  WHERE subcategory_id IS NULL
    AND enginetype IN ('GROWTH', 'FULFILLMENT');
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  Machines with subcategory_id: %', machines_with_subcategory;
  RAISE NOTICE '  Machines without subcategory_id: %', machines_without_subcategory;
END $$;

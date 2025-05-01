-- Create battle_plan table
CREATE TABLE IF NOT EXISTS battle_plan (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  businessPlanLink TEXT DEFAULT '',
  missionStatement TEXT DEFAULT '',
  visionStatement TEXT DEFAULT '',
  purposeWhy JSONB[] DEFAULT '{}',
  strategicAnchors JSONB[] DEFAULT '{}',
  coreValues JSONB[] DEFAULT '{}',
  threeYearTarget JSONB[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create RLS policies for the battle_plan table
ALTER TABLE battle_plan ENABLE ROW LEVEL SECURITY;

-- Allow users to view only their own data
CREATE POLICY battle_plan_select_policy ON battle_plan
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert only their own data
CREATE POLICY battle_plan_insert_policy ON battle_plan
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update only their own data
CREATE POLICY battle_plan_update_policy ON battle_plan
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete only their own data
CREATE POLICY battle_plan_delete_policy ON battle_plan
  FOR DELETE USING (auth.uid() = user_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to update the updated_at timestamp
CREATE TRIGGER update_battle_plan_updated_at
  BEFORE UPDATE ON battle_plan
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column(); 
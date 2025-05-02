-- Create playbooks table
CREATE TABLE IF NOT EXISTS playbooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  playbookName TEXT NOT NULL,
  description TEXT,
  engineType TEXT NOT NULL CHECK (engineType IN ('GROWTH', 'FULFILLMENT', 'INNOVATION')),
  owner TEXT,
  status TEXT NOT NULL CHECK (status IN ('Backlog', 'In Progress', 'Behind', 'Completed')),
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create RLS policies for the playbooks table
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;

-- Allow users to view only their own data
CREATE POLICY playbooks_select_policy ON playbooks
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert only their own data
CREATE POLICY playbooks_insert_policy ON playbooks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update only their own data
CREATE POLICY playbooks_update_policy ON playbooks
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete only their own data
CREATE POLICY playbooks_delete_policy ON playbooks
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
CREATE TRIGGER update_playbooks_updated_at
  BEFORE UPDATE ON playbooks
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column(); 
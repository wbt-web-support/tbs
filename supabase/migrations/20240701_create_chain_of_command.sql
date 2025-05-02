-- Create chain_of_command table
CREATE TABLE IF NOT EXISTS chain_of_command (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  manager TEXT DEFAULT '',
  jobTitle TEXT DEFAULT '',
  criticalAccountabilities JSONB[] DEFAULT '{}',
  playbooksOwned JSONB[] DEFAULT '{}',
  department TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create RLS policies for the chain_of_command table
ALTER TABLE chain_of_command ENABLE ROW LEVEL SECURITY;

-- Allow users to view only their own data
CREATE POLICY chain_of_command_select_policy ON chain_of_command
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert only their own data
CREATE POLICY chain_of_command_insert_policy ON chain_of_command
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update only their own data
CREATE POLICY chain_of_command_update_policy ON chain_of_command
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete only their own data
CREATE POLICY chain_of_command_delete_policy ON chain_of_command
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_chain_of_command_updated_at
  BEFORE UPDATE ON chain_of_command
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 
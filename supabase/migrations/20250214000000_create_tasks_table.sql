-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255),
    description TEXT NOT NULL,
    links TEXT,
    task_type VARCHAR(10) NOT NULL DEFAULT 'self' CHECK (task_type IN ('team', 'self', 'shared')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    start_date DATE,
    due_date DATE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks(start_date);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
DROP POLICY IF EXISTS "Allow authenticated users to read tasks" ON tasks;
CREATE POLICY "Allow authenticated users to read tasks" ON tasks
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to insert tasks" ON tasks;
CREATE POLICY "Allow authenticated users to insert tasks" ON tasks
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to update tasks" ON tasks;
CREATE POLICY "Allow authenticated users to update tasks" ON tasks
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to delete tasks" ON tasks;
CREATE POLICY "Allow authenticated users to delete tasks" ON tasks
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_tasks_updated_at();

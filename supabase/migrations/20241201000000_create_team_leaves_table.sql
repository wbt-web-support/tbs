-- Create team_leaves table
CREATE TABLE IF NOT EXISTS team_leaves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  duration_days INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bank_holidays table
CREATE TABLE IF NOT EXISTS bank_holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  year INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE team_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_holidays ENABLE ROW LEVEL SECURITY;

-- Team leaves policies
CREATE POLICY "Users can view their own leaves" ON team_leaves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own leaves" ON team_leaves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leaves" ON team_leaves
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leaves" ON team_leaves
  FOR DELETE USING (auth.uid() = user_id);

-- Team members can view each other's leaves
CREATE POLICY "Team members can view team leaves" ON team_leaves
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM business_info bi1
      JOIN business_info bi2 ON bi1.team_id = bi2.team_id
      WHERE bi1.user_id = auth.uid() 
      AND bi2.user_id = team_leaves.user_id
    )
  );

-- Bank holidays policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view bank holidays" ON bank_holidays
  FOR SELECT USING (auth.role() = 'authenticated');

-- Insert default UK bank holidays for 2025
INSERT INTO bank_holidays (holiday_name, holiday_date, year) VALUES
  ('New Year''s Day', '2025-01-01', 2025),
  ('Good Friday', '2025-04-18', 2025),
  ('Easter Monday', '2025-04-21', 2025),
  ('Early May Bank Holiday', '2025-05-05', 2025),
  ('Spring Bank Holiday', '2025-05-26', 2025),
  ('Summer Bank Holiday', '2025-08-25', 2025),
  ('Christmas Day', '2025-12-25', 2025),
  ('Boxing Day', '2025-12-26', 2025);

-- Create indexes for better performance
CREATE INDEX idx_team_leaves_user_id ON team_leaves(user_id);
CREATE INDEX idx_team_leaves_dates ON team_leaves(start_date, end_date);
CREATE INDEX idx_team_leaves_status ON team_leaves(status);
CREATE INDEX idx_bank_holidays_year_date ON bank_holidays(year, holiday_date); 
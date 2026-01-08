-- Add extracted_text column to finance_files
ALTER TABLE finance_files ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- Create finance_analysis table
CREATE TABLE IF NOT EXISTS finance_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES finance_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL,
  analysis_result JSONB NOT NULL, -- Structured data for charts
  summary TEXT,                   -- AI commentary
  status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  period_type TEXT DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'yearly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()

);

-- Enable RLS
ALTER TABLE finance_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their team's analysis
CREATE POLICY "Users can view team finance analysis"
  ON finance_analysis FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM business_info WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert their own analysis
CREATE POLICY "Users can insert finance analysis"
  ON finance_analysis FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can delete their own analysis or team admin can delete
CREATE POLICY "Users can delete own finance analysis"
  ON finance_analysis FOR DELETE
  USING (
    user_id = auth.uid() OR
    team_id IN (
      SELECT team_id FROM business_info 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_finance_analysis_file_id ON finance_analysis(file_id);
CREATE INDEX IF NOT EXISTS idx_finance_analysis_team_id ON finance_analysis(team_id);

-- Add comments for clarity
COMMENT ON COLUMN finance_analysis.period_type IS 'Type of data period: monthly or yearly.';


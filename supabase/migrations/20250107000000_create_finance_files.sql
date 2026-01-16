-- Create finance_files table
CREATE TABLE IF NOT EXISTS finance_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  month TEXT, -- Optional for yearly data
  year TEXT NOT NULL,
  period_type TEXT DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'yearly')),
  uploaded_by TEXT NOT NULL,

  extracted_text TEXT,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE finance_files ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their team's files
CREATE POLICY "Users can view team finance files"
  ON finance_files FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM business_info WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert their own files
CREATE POLICY "Users can insert finance files"
  ON finance_files FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can delete their own files or team admin can delete
CREATE POLICY "Users can delete own finance files"
  ON finance_files FOR DELETE
  USING (
    user_id = auth.uid() OR
    team_id IN (
      SELECT team_id FROM business_info 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_finance_files_user_id ON finance_files(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_files_team_id ON finance_files(team_id);
CREATE INDEX IF NOT EXISTS idx_finance_files_month_year ON finance_files(month, year);
CREATE INDEX IF NOT EXISTS idx_finance_files_upload_date ON finance_files(upload_date DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_finance_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER finance_files_updated_at
  BEFORE UPDATE ON finance_files
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_files_updated_at();

-- Add comments for clarity
COMMENT ON COLUMN finance_files.period_type IS 'Type of data period: monthly or yearly. If yearly, month can be null or "Full Year".';


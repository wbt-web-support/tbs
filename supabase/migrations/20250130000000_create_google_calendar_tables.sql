-- Create table to store Google Calendar OAuth tokens for each user
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamp with time zone,
  scope text,
  token_type text DEFAULT 'Bearer',
  calendar_id text DEFAULT 'primary', -- Google Calendar ID (usually 'primary')
  account_name text, -- Google account name/email for display
  sync_token text, -- For incremental sync
  last_sync_at timestamp with time zone,
  sync_status text DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'error')),
  error_message text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id)
);

-- Create table to cache Google Calendar events
CREATE TABLE IF NOT EXISTS google_calendar_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id text NOT NULL, -- Google Calendar event ID
  calendar_id text DEFAULT 'primary',
  title text NOT NULL,
  description text,
  location text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  all_day boolean DEFAULT false,
  timezone text,
  event_link text, -- Link to event in Google Calendar
  attendees jsonb DEFAULT '[]', -- Array of attendee objects
  recurrence jsonb, -- Recurrence rule if applicable
  status text DEFAULT 'confirmed', -- confirmed, tentative, cancelled
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_synced_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, google_event_id, calendar_id)
);

-- Enable RLS
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_events ENABLE ROW LEVEL SECURITY;

-- Create policies for google_calendar_tokens
CREATE POLICY "Users can view their own calendar tokens" ON google_calendar_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar tokens" ON google_calendar_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar tokens" ON google_calendar_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar tokens" ON google_calendar_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for google_calendar_events
CREATE POLICY "Users can view their own calendar events" ON google_calendar_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar events" ON google_calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar events" ON google_calendar_events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar events" ON google_calendar_events
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_google_calendar_tokens_user_id ON google_calendar_tokens(user_id);
CREATE INDEX idx_google_calendar_events_user_id ON google_calendar_events(user_id);
CREATE INDEX idx_google_calendar_events_dates ON google_calendar_events(start_time, end_time);
CREATE INDEX idx_google_calendar_events_google_id ON google_calendar_events(google_event_id, calendar_id);
CREATE INDEX idx_google_calendar_events_last_synced ON google_calendar_events(last_synced_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_google_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_google_calendar_tokens_updated_at
  BEFORE UPDATE ON google_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION update_google_calendar_updated_at();

CREATE TRIGGER update_google_calendar_events_updated_at
  BEFORE UPDATE ON google_calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_google_calendar_updated_at();


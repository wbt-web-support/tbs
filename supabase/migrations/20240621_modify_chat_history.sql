-- Drop existing chat_history table
DROP TABLE IF EXISTS public.chat_history;

-- Create new chat_history table with a JSONB messages column
CREATE TABLE public.chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_history_user_id_key UNIQUE (user_id)
);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS chat_history_user_id_idx ON public.chat_history (user_id);

-- Create trigger for automatically updating the 'updated_at' column
CREATE TRIGGER update_chat_history_updated_at
BEFORE UPDATE ON public.chat_history
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Apply RLS policies
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own chat history
CREATE POLICY "Users can manage their own chat history"
ON public.chat_history
FOR ALL
TO authenticated
USING (auth.uid() = user_id); 
-- Create chat_ideas table for storing saved chat conversations as ideas
create table public.chat_ideas (
  id uuid not null default extensions.uuid_generate_v4(),
  user_id uuid not null,
  title text not null,
  summary text not null,
  original_chat_id uuid not null,
  original_messages jsonb not null default '[]'::jsonb,
  tags text[] default array[]::text[],
  is_active boolean not null default true,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint chat_ideas_pkey primary key (id),
  constraint chat_ideas_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint chat_ideas_original_chat_id_fkey foreign key (original_chat_id) references public.chat_history(id) on delete cascade
) tablespace pg_default;

-- Create indexes for efficient querying
create index if not exists idx_chat_ideas_user_id_updated_at 
on public.chat_ideas (user_id, updated_at desc) tablespace pg_default;

create index if not exists idx_chat_ideas_user_id_active 
on public.chat_ideas (user_id, is_active) tablespace pg_default;

create index if not exists idx_chat_ideas_original_chat_id 
on public.chat_ideas (original_chat_id) tablespace pg_default;

create index if not exists idx_chat_ideas_tags 
on public.chat_ideas using gin (tags) tablespace pg_default;

-- Create trigger to update the updated_at timestamp automatically
create trigger update_chat_ideas_updated_at 
before update on chat_ideas 
for each row
execute function update_updated_at_column();

-- Grant permissions (RLS will be handled by app-level auth)
alter table public.chat_ideas enable row level security;

-- Create RLS policies for chat ideas
create policy "Users can view their own chat ideas" on public.chat_ideas
  for select using (auth.uid() = user_id);

create policy "Users can insert their own chat ideas" on public.chat_ideas
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own chat ideas" on public.chat_ideas
  for update using (auth.uid() = user_id);

create policy "Users can delete their own chat ideas" on public.chat_ideas
  for delete using (auth.uid() = user_id);

-- Add comments for documentation
comment on table public.chat_ideas is 'Stores saved chat conversations as ideas for future reference';
comment on column public.chat_ideas.summary is 'AI-generated summary of the chat conversation';
comment on column public.chat_ideas.original_messages is 'Complete conversation history preserved for context';
comment on column public.chat_ideas.tags is 'User-defined tags for organizing ideas'; 
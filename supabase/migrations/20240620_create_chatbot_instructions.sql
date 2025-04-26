-- Create chatbot instructions table
create table public.chatbot_instructions (
  id uuid not null default gen_random_uuid(),
  title text not null,
  content text not null,
  content_type text not null,  -- 'text', 'pdf', 'doc', 'link', 'youtube', 'loom', 'vimeo', 'faq'
  url text null,               -- For external resources like videos, PDFs, docs
  is_active boolean not null default true, -- New column to toggle instructions
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  created_by uuid null,
  constraint chatbot_instructions_pkey primary key (id),
  constraint chatbot_instructions_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null,
  constraint chatbot_instructions_content_type_check check (
    (
      content_type = any (array['text'::text, 'pdf'::text, 'doc'::text, 'link'::text, 'youtube'::text, 'loom'::text, 'vimeo'::text, 'faq'::text])
    )
  )
) tablespace pg_default;

-- Index for faster queries
create index if not exists chatbot_instructions_content_type_idx on public.chatbot_instructions using btree (content_type) tablespace pg_default;

-- Create trigger for updated_at
create trigger update_chatbot_instructions_updated_at before
update on chatbot_instructions for each row
execute function update_updated_at_column();

-- Insert default instruction
insert into public.chatbot_instructions (title, content, content_type)
values (
  'Default Instructions', 
  'your name is alice and you work for a company called ''Trades Business School''. Alwasys talk in uk accent.', 
  'text'
);

-- Create RLS policies
alter table public.chatbot_instructions enable row level security;

-- Only super_admin can view instructions
create policy "Super admin can view instructions"
  on public.chatbot_instructions for select
  to authenticated
  using (
    exists (
      select 1
      from public.business_info
      where business_info.user_id = auth.uid()
      and business_info.role = 'super_admin'
    )
  );

-- Only super_admin can manage instructions
create policy "Super admin can manage instructions"
  on public.chatbot_instructions for all
  to authenticated
  using (
    exists (
      select 1
      from public.business_info
      where business_info.user_id = auth.uid()
      and business_info.role = 'super_admin'
    )
  ); 
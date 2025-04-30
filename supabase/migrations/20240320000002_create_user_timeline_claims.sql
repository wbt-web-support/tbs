-- Create user timeline claims table
create table public.user_timeline_claims (
  id uuid not null default extensions.uuid_generate_v4(),
  user_id uuid not null,
  timeline_id uuid not null,
  is_completed boolean not null default false,
  completion_date timestamp with time zone null,
  notes text null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint user_timeline_claims_pkey primary key (id),
  constraint user_timeline_claims_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint user_timeline_claims_timeline_id_fkey foreign key (timeline_id) references chq_timeline(id) on delete cascade,
  constraint user_timeline_claims_user_timeline_unique unique (user_id, timeline_id)
) tablespace pg_default;

-- Create indexes
create index if not exists idx_user_timeline_claims_user_id on public.user_timeline_claims using btree (user_id) tablespace pg_default;
create index if not exists idx_user_timeline_claims_timeline_id on public.user_timeline_claims using btree (timeline_id) tablespace pg_default;

-- Create trigger for updated_at
create trigger update_user_timeline_claims_updated_at
  before update on user_timeline_claims
  for each row
  execute function update_updated_at_column();

-- Modify chq_timeline table to remove user-specific fields
alter table public.chq_timeline
  drop column user_id,
  drop column is_completed,
  drop column completion_date;

-- Drop the old index
drop index if exists idx_chq_timeline_user_id; 
-- Create user checklist claims table
create table public.user_checklist_claims (
  id uuid not null default extensions.uuid_generate_v4(),
  user_id uuid not null,
  checklist_id uuid not null,
  is_completed boolean not null default false,
  completion_date timestamp with time zone null,
  notes text null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint user_checklist_claims_pkey primary key (id),
  constraint user_checklist_claims_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint user_checklist_claims_checklist_id_fkey foreign key (checklist_id) references chq_checklist(id) on delete cascade,
  constraint user_checklist_claims_user_checklist_unique unique (user_id, checklist_id)
) tablespace pg_default;

-- Create indexes
create index if not exists idx_user_checklist_claims_user_id on public.user_checklist_claims using btree (user_id) tablespace pg_default;
create index if not exists idx_user_checklist_claims_checklist_id on public.user_checklist_claims using btree (checklist_id) tablespace pg_default;

-- Create trigger for updated_at
create trigger update_user_checklist_claims_updated_at
  before update on user_checklist_claims
  for each row
  execute function update_updated_at_column();

-- Modify chq_checklist table to remove user-specific fields
alter table public.chq_checklist
  drop column user_id,
  drop column is_completed,
  drop column completion_date;

-- Drop the old index
drop index if exists idx_chq_checklist_user_id; 
-- Create user benefit claims table
create table public.user_benefit_claims (
  id uuid not null default extensions.uuid_generate_v4(),
  user_id uuid not null,
  benefit_id uuid not null,
  is_claimed boolean not null default false,
  claimed_date timestamp with time zone null,
  notes text null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint user_benefit_claims_pkey primary key (id),
  constraint user_benefit_claims_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint user_benefit_claims_benefit_id_fkey foreign key (benefit_id) references chq_benefits(id) on delete cascade,
  constraint user_benefit_claims_user_benefit_unique unique (user_id, benefit_id)
) tablespace pg_default;

-- Create indexes
create index if not exists idx_user_benefit_claims_user_id on public.user_benefit_claims using btree (user_id) tablespace pg_default;
create index if not exists idx_user_benefit_claims_benefit_id on public.user_benefit_claims using btree (benefit_id) tablespace pg_default;

-- Create trigger for updated_at
create trigger update_user_benefit_claims_updated_at
  before update on user_benefit_claims
  for each row
  execute function update_updated_at_column();

-- Modify chq_benefits table to remove user-specific fields
alter table public.chq_benefits
  drop column user_id,
  drop column is_claimed,
  drop column claimed_date;

-- Drop the old index
drop index if exists idx_chq_benefits_user_id; 
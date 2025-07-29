-- Add missing fields to battle_plan table
ALTER TABLE public.battle_plan 
ADD COLUMN oneyeartarget jsonb[] null default '{}'::jsonb[],
ADD COLUMN tenyeartarget jsonb[] null default '{}'::jsonb[];

-- Add comments to explain the fields
COMMENT ON COLUMN public.battle_plan.oneyeartarget IS 'One year targets for the business plan';
COMMENT ON COLUMN public.battle_plan.tenyeartarget IS 'Ten year targets for the business plan'; 
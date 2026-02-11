-- ============================================================
-- CLEANUP: Remove all test data (prefix aaaaaaaa-)
-- Run this after testing is complete.
-- Order: reverse FK dependency (children first, parents last)
-- ============================================================

DELETE FROM public.finance_analysis     WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.finance_files        WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.leave_approvals      WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.playbook_assignments WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.machines             WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.google_calendar_events WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.leave_entitlements   WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.team_leaves          WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.tasks                WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.sop_data             WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.battle_plan          WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.business_owner_instructions WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.company_onboarding   WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.software             WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.playbooks            WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.team_services        WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.business_info        WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.global_services      WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM public.departments          WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM auth.users                  WHERE id::text LIKE 'aaaaaaaa-0000-0000-0000-%';

-- Reset Dan's team_id back to null (was set for testing)
UPDATE public.business_info SET team_id = NULL WHERE user_id = '23dca817-2c23-4ed1-a5f3-75fc598a7e88';

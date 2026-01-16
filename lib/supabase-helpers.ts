/**
 * Global Supabase Query Helpers
 * 
 * These helpers automatically use the effective user ID for common queries,
 * making it easy to update pages without manual changes.
 */

import { createClient } from '@/utils/supabase/server';
import { getEffectiveUser } from '@/lib/get-effective-user';

/**
 * Get effective user ID for server components
 * Use this in any server component to get the correct user ID
 */
export async function getEffectiveUserIdServer(): Promise<string | null> {
  const effectiveUser = await getEffectiveUser();
  return effectiveUser?.userId || null;
}

/**
 * Query business_info for the effective user
 */
export async function getEffectiveBusinessInfo() {
  const supabase = await createClient();
  const effectiveUserId = await getEffectiveUserIdServer();
  
  if (!effectiveUserId) return null;
  
  const { data, error } = await supabase
    .from('business_info')
    .select('*')
    .eq('user_id', effectiveUserId)
    .single();
    
  if (error) {
    console.error('[getEffectiveBusinessInfo] Error:', error);
    return null;
  }
  
  return data;
}

/**
 * Query any user-scoped table for the effective user
 */
export async function queryEffectiveUser<T = any>(
  table: string,
  select?: string
) {
  const supabase = await createClient();
  const effectiveUserId = await getEffectiveUserIdServer();
  
  if (!effectiveUserId) return { data: null, error: new Error('No effective user ID') };
  
  let query = supabase.from(table).select(select || '*');
  
  // Auto-add user_id filter for known user-scoped tables
  const userScopedTables = [
    'business_info',
    'company_onboarding',
    'ai_onboarding_questions',
    'chat_history',
    'battle_plan',
    'machines',
    'meeting_rhythm_planner',
    'playbooks',
    'quarterly_sprint_canvas',
    'triage_planner',
    'google_analytics_tokens',
    'superadmin_analytics_assignments',
    'user_timeline_claims',
  ];
  
  if (userScopedTables.includes(table)) {
    query = query.eq('user_id', effectiveUserId) as any;
  }
  
  return query as Promise<{ data: T | null; error: any }>;
}

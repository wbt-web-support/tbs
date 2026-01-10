/**
 * Effective User Supabase Client Wrapper
 * 
 * This module provides Supabase client wrappers that automatically use
 * the effective user ID (impersonated user if active, otherwise actual user)
 * for all queries. This eliminates the need to manually update each page.
 */

import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient as createBrowserClient } from '@/utils/supabase/client';
import { getEffectiveUser } from '@/lib/get-effective-user';
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side: Get Supabase client with effective user context
 * 
 * This wrapper automatically uses the effective user ID for queries.
 * Use this instead of the regular createClient() in server components.
 * 
 * @returns Object with supabase client and effectiveUserId
 */
export async function createEffectiveClient() {
  const supabase = await createServerClient();
  const effectiveUser = await getEffectiveUser();
  const effectiveUserId = effectiveUser?.userId || null;

  // Return a wrapper that intercepts queries to use effective user ID
  return {
    supabase,
    effectiveUserId,
    effectiveUser,
    // Helper method to get user ID for queries
    getUserId: () => effectiveUserId,
  };
}

/**
 * Client-side: Get effective user ID
 * 
 * Use this in client components to get the effective user ID
 * and then use it in your queries.
 * 
 * @returns effectiveUserId string or null
 */
export async function getEffectiveUserIdClient(): Promise<string | null> {
  return await getEffectiveUserId();
}

/**
 * Server-side: Create a query helper that automatically uses effective user ID
 * 
 * Usage:
 * const { query } = await createEffectiveQuery();
 * const { data } = await query.from('business_info').select('*').eq('user_id', query.userId).single();
 */
export async function createEffectiveQuery() {
  const { supabase, effectiveUserId } = await createEffectiveClient();
  
  if (!effectiveUserId) {
    throw new Error('No effective user ID available');
  }

  return {
    ...supabase,
    userId: effectiveUserId, // Convenience property
    // Override common query methods to auto-inject user_id
    from: (table: string) => {
      const query = supabase.from(table);
      return {
        ...query,
        // Auto-add user_id filter for user-scoped tables
        select: (columns?: string) => {
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
          ];
          
          if (userScopedTables.includes(table)) {
            return query.select(columns).eq('user_id', effectiveUserId);
          }
          return query.select(columns);
        },
      };
    },
  };
}

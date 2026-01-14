/**
 * Server-side Supabase client with automatic effective user support
 * 
 * This is a drop-in replacement for the regular server client that
 * automatically handles impersonation by using the effective user ID.
 * 
 * Usage:
 *   import { createClient } from '@/utils/supabase/server-effective';
 *   const supabase = await createClient();
 *   const effectiveUserId = await supabase.getEffectiveUserId();
 *   
 *   // Then use effectiveUserId in your queries
 *   const { data } = await supabase
 *     .from('business_info')
 *     .select('*')
 *     .eq('user_id', effectiveUserId)
 *     .single();
 */

import { createClient as createBaseClient } from '@/utils/supabase/server';
import { getEffectiveUser } from '@/lib/get-effective-user';
import type { SupabaseClient } from '@supabase/supabase-js';

type EffectiveSupabaseClient = SupabaseClient & {
  getEffectiveUserId: () => Promise<string | null>;
  getEffectiveUser: () => Promise<ReturnType<typeof getEffectiveUser>>;
};

/**
 * Create a Supabase client with effective user support
 * 
 * This client includes helper methods to get the effective user ID,
 * which automatically handles impersonation.
 */
export async function createClient(): Promise<EffectiveSupabaseClient> {
  const supabase = await createBaseClient();
  
  // Add helper methods to the client
  const effectiveClient = supabase as EffectiveSupabaseClient;
  
  effectiveClient.getEffectiveUserId = async () => {
    const effectiveUser = await getEffectiveUser();
    return effectiveUser?.userId || null;
  };
  
  effectiveClient.getEffectiveUser = async () => {
    return await getEffectiveUser();
  };
  
  return effectiveClient;
}

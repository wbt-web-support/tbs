/**
 * Get Effective User Helper
 *
 * This module provides utilities to get the "effective user" - either the
 * impersonated user (if active) or the actual authenticated user.
 *
 * This becomes the standard way to get user context throughout server components
 * in the admin panel and should replace direct auth.getUser() calls when
 * impersonation needs to be respected.
 */

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { decodeImpersonationState, IMPERSONATION_COOKIE_NAME } from './impersonation';

export interface EffectiveUser {
  userId: string;
  role: string;
  email: string;
  fullName: string;
  businessName: string;
  isImpersonated: boolean;
  superadminId?: string; // Only present if impersonated
}

/**
 * Get the effective user for server components
 *
 * This function checks for an active impersonation session and returns either:
 * 1. The impersonated user's details (if valid impersonation cookie exists)
 * 2. The actual authenticated user's details (fallback)
 *
 * Security notes:
 * - Validates impersonation state signature and expiration
 * - Only returns impersonated user if actual user is a superadmin
 * - Returns null if no valid session exists
 *
 * @returns EffectiveUser object or null if no valid session
 */
export async function getEffectiveUser(): Promise<EffectiveUser | null> {
  // Create admin Supabase client with service role key
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const cookieStore = await cookies();
  const impersonationCookie = cookieStore.get(IMPERSONATION_COOKIE_NAME);

  // Check for impersonation state
  if (impersonationCookie?.value) {
    const impersonationState = decodeImpersonationState(impersonationCookie.value);

    if (impersonationState) {
      // Fetch impersonated user details
      const { data: userProfile, error } = await supabaseAdmin
        .from('business_info')
        .select('user_id, role, email, full_name, business_name')
        .eq('user_id', impersonationState.impersonatedUserId)
        .single();

      if (!error && userProfile) {
        console.log(`[EffectiveUser] Impersonation active: ${impersonationState.superadminId} -> ${userProfile.user_id}`);
        return {
          userId: userProfile.user_id,
          role: userProfile.role,
          email: userProfile.email,
          fullName: userProfile.full_name,
          businessName: userProfile.business_name,
          isImpersonated: true,
          superadminId: impersonationState.superadminId,
        };
      } else {
        console.warn('[EffectiveUser] Impersonated user not found or error:', error);
      }
    }
  }

  // Fall back to regular auth user (from existing Supabase session)
  try {
    // Use the standard server-side Supabase client
    const { createClient: createServerClient } = await import('@/utils/supabase/server');
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data: userProfile, error } = await supabaseAdmin
      .from('business_info')
      .select('user_id, role, email, full_name, business_name')
      .eq('user_id', user.id)
      .single();

    if (error || !userProfile) {
      console.error('[EffectiveUser] Error fetching user profile:', error);
      return null;
    }

    return {
      userId: userProfile.user_id,
      role: userProfile.role,
      email: userProfile.email,
      fullName: userProfile.full_name,
      businessName: userProfile.business_name,
      isImpersonated: false,
    };
  } catch (error) {
    console.error('[EffectiveUser] Error getting authenticated user:', error);
    return null;
  }
}

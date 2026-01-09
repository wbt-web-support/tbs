/**
 * Impersonation Status API Endpoint
 *
 * GET /api/admin/impersonate/status
 *
 * Returns the current impersonation status and details of the impersonated user (if active).
 * Used by the client to show impersonation banner and update UI state.
 *
 * Security:
 * - Validates impersonation cookie
 * - Only returns data if impersonation state is valid (signature, expiration)
 * - Returns minimal user information for privacy
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import {
  decodeImpersonationState,
  IMPERSONATION_COOKIE_NAME,
} from '@/lib/impersonation';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const impersonationCookie = cookieStore.get(IMPERSONATION_COOKIE_NAME);

    // No impersonation cookie found
    if (!impersonationCookie?.value) {
      return NextResponse.json({
        isImpersonating: false,
      });
    }

    // Decode and validate impersonation state
    const impersonationState = decodeImpersonationState(impersonationCookie.value);

    // Invalid or expired impersonation state
    if (!impersonationState) {
      return NextResponse.json({
        isImpersonating: false,
        error: 'Invalid or expired impersonation state',
      });
    }

    // Fetch impersonated user details from database
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: userProfile, error } = await supabaseAdmin
      .from('business_info')
      .select('email, full_name, business_name, role')
      .eq('user_id', impersonationState.impersonatedUserId)
      .single();

    if (error || !userProfile) {
      console.warn('[Impersonate Status] User not found:', impersonationState.impersonatedUserId);
      return NextResponse.json({
        isImpersonating: false,
        error: 'Impersonated user not found',
      });
    }

    // Return active impersonation details
    return NextResponse.json({
      isImpersonating: true,
      impersonatedUser: {
        email: userProfile.email,
        fullName: userProfile.full_name,
        businessName: userProfile.business_name,
        role: userProfile.role,
      },
      expiresAt: impersonationState.expiresAt,
      startedAt: impersonationState.startedAt,
    });
  } catch (error) {
    console.error('[Impersonate Status] Error:', error);
    return NextResponse.json({
      isImpersonating: false,
      error: 'Internal server error',
    });
  }
}

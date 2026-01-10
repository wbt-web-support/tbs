/**
 * Get Effective User ID API Endpoint
 * 
 * GET /api/user/effective-id
 * 
 * Returns the effective user ID - either the impersonated user ID (if active)
 * or the actual authenticated user ID.
 * 
 * This endpoint is used by client components to determine which user's data
 * they should be displaying.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import {
  decodeImpersonationState,
  IMPERSONATION_COOKIE_NAME,
} from '@/lib/impersonation';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for impersonation
    const cookieStore = await cookies();
    const impersonationCookie = cookieStore.get(IMPERSONATION_COOKIE_NAME);

    if (impersonationCookie?.value) {
      const impersonationState = decodeImpersonationState(impersonationCookie.value);

      if (impersonationState) {
        // Verify the actual user is a superadmin
        const { data: actualUserData } = await supabase
          .from('business_info')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (actualUserData?.role === 'super_admin') {
          // Return the impersonated user ID
          return NextResponse.json({
            effectiveUserId: impersonationState.impersonatedUserId,
            isImpersonated: true,
            actualUserId: user.id,
          });
        }
      }
    }

    // Return the actual user ID
    return NextResponse.json({
      effectiveUserId: user.id,
      isImpersonated: false,
      actualUserId: user.id,
    });
  } catch (error) {
    console.error('[Effective User ID] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

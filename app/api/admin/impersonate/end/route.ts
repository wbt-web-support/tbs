/**
 * End Impersonation API Endpoint
 *
 * POST /api/admin/impersonate/end
 *
 * Allows a superadmin to exit an active impersonation session.
 * Clears the impersonation cookie and logs the action to audit table.
 *
 * Security:
 * - Validates impersonation cookie exists and is valid
 * - Verifies actual user is still authenticated
 * - Logs all impersonation ends with IP and user agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import {
  decodeImpersonationState,
  getImpersonationCookieOptions,
  logImpersonationAction,
  IMPERSONATION_COOKIE_NAME,
} from '@/lib/impersonation';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const impersonationCookie = cookieStore.get(IMPERSONATION_COOKIE_NAME);

    if (!impersonationCookie?.value) {
      return NextResponse.json(
        { error: 'No active impersonation session' },
        { status: 400 }
      );
    }

    const impersonationState = decodeImpersonationState(impersonationCookie.value);

    if (!impersonationState) {
      return NextResponse.json(
        { error: 'Invalid or expired impersonation state' },
        { status: 400 }
      );
    }

    // Verify the actual user is still authenticated and is the same superadmin
    const supabase = await createClient();
    const { data: { user: actualUser } } = await supabase.auth.getUser();

    if (!actualUser || actualUser.id !== impersonationState.superadminId) {
      return NextResponse.json(
        { error: 'Unauthorized - session mismatch' },
        { status: 401 }
      );
    }

    // Get client IP and user agent for audit logging
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Log the end action to audit table
    await logImpersonationAction(
      impersonationState.superadminId,
      impersonationState.impersonatedUserId,
      'end',
      ipAddress,
      userAgent
    );

    // Create response and clear cookie
    const response = NextResponse.json({
      success: true,
      message: 'Impersonation ended successfully',
    });

    const cookieOptions = getImpersonationCookieOptions('remove');
    response.cookies.set(
      cookieOptions.name,
      cookieOptions.value,
      {
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        path: cookieOptions.path,
        maxAge: cookieOptions.maxAge,
      }
    );

    console.log(
      `[Impersonate End] ${impersonationState.superadminId} exited impersonation of ${impersonationState.impersonatedUserId}`
    );

    return response;
  } catch (error) {
    console.error('[Impersonate End] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

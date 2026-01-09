/**
 * Start Impersonation API Endpoint
 *
 * POST /api/admin/impersonate/start
 *
 * Allows a superadmin to start impersonating an admin user.
 * Creates a signed impersonation cookie and logs the action to audit table.
 *
 * Security:
 * - Verifies superadmin authentication
 * - Only allows impersonating users with 'admin' role
 * - Creates HMAC-signed cookie to prevent tampering
 * - Logs all impersonation starts with IP and user agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  createImpersonationState,
  encodeImpersonationState,
  getImpersonationCookieOptions,
  logImpersonationAction,
} from '@/lib/impersonation';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify superadmin authentication
    const { data: { user: actualUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !actualUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify superadmin role
    const { data: actualUserProfile } = await supabase
      .from('business_info')
      .select('role')
      .eq('user_id', actualUser.id)
      .single();

    if (actualUserProfile?.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only superadmins can impersonate users.' },
        { status: 403 }
      );
    }

    // Get target user from request
    const { targetUserId } = await request.json();

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Target user ID required' },
        { status: 400 }
      );
    }

    // Verify target user exists and is an admin
    const { data: targetUser, error: targetError } = await supabase
      .from('business_info')
      .select('user_id, role, email, full_name, business_name')
      .eq('user_id', targetUserId)
      .single();

    if (targetError || !targetUser) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    if (targetUser.role !== 'admin') {
      return NextResponse.json(
        {
          error: 'Can only impersonate users with admin role',
          targetRole: targetUser.role,
        },
        { status: 400 }
      );
    }

    // Create impersonation state
    const impersonationState = createImpersonationState(
      actualUser.id,
      targetUser.user_id,
      targetUser.role
    );

    // Get client IP and user agent for audit logging
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Log the action to audit table
    await logImpersonationAction(
      actualUser.id,
      targetUser.user_id,
      'start',
      ipAddress,
      userAgent
    );

    // Create response with impersonation cookie
    const response = NextResponse.json({
      success: true,
      impersonatedUser: {
        userId: targetUser.user_id,
        email: targetUser.email,
        fullName: targetUser.full_name,
        businessName: targetUser.business_name,
        role: targetUser.role,
      },
      expiresAt: impersonationState.expiresAt,
    });

    // Set impersonation cookie
    const cookieOptions = getImpersonationCookieOptions('set');
    response.cookies.set(
      cookieOptions.name,
      encodeImpersonationState(impersonationState),
      {
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        path: cookieOptions.path,
        maxAge: cookieOptions.maxAge,
      }
    );

    console.log(
      `[Impersonate Start] ${actualUser.email} -> ${targetUser.email} (${targetUser.role})`
    );

    return response;
  } catch (error) {
    console.error('[Impersonate Start] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

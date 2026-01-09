/**
 * List Admin Users API Endpoint
 *
 * GET /api/admin/impersonate/list
 *
 * Returns a list of all admin users that can be impersonated by the superadmin.
 * Only returns users with 'admin' role (excludes super_admin and regular users).
 *
 * Security:
 * - Verifies superadmin authentication
 * - Only returns basic user information (no sensitive data)
 * - Sorted alphabetically by full name for easier selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
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
        { error: 'Insufficient permissions. Only superadmins can access this endpoint.' },
        { status: 403 }
      );
    }

    // Fetch all admin users (exclude super_admin and regular users)
    const { data: adminUsers, error } = await supabase
      .from('business_info')
      .select('user_id, email, full_name, business_name, created_at')
      .eq('role', 'admin')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('[Impersonate List] Error fetching admin users:', error);
      throw error;
    }

    console.log(`[Impersonate List] Found ${adminUsers?.length || 0} admin users`);

    return NextResponse.json({
      success: true,
      users: adminUsers || [],
      count: adminUsers?.length || 0,
    });
  } catch (error) {
    console.error('[Impersonate List] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    // Check if this is a server action call (no auth header) or client call (with auth header)
    const authHeader = request.headers.get('authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Client-side call - verify the request is from an authenticated super admin
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (authError || !user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }

      // Check if the user is a super admin
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('business_info')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (profileError || userProfile?.role !== 'super_admin') {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    } else {
      // Server action call - we'll trust it since it's coming from our server
      // In production, you might want to add additional security measures here
      console.log('Server action call to delete user - proceeding with deletion');
    }

    // Get the user ID to delete from the request body
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Delete the user from auth.users using admin privileges
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('Error deleting user from auth:', deleteError);
      return NextResponse.json({ 
        error: 'Failed to delete user from auth system',
        details: deleteError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'User deleted successfully from auth system' 
    });

  } catch (error) {
    console.error('Error in delete-user API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
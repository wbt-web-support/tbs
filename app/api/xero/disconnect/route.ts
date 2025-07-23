import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { XeroAPI } from '@/lib/xero-api';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    // Get tenant ID from request body (optional - if not provided, disconnects all)
    const body = await request.json().catch(() => ({}));
    const { tenantId } = body;

    const xeroAPI = new XeroAPI(supabase);

    // Disconnect specific tenant or all connections
    await xeroAPI.disconnect(user.id, tenantId);

    return NextResponse.json({ 
      success: true,
      message: tenantId 
        ? 'Xero connection disconnected successfully' 
        : 'All Xero connections disconnected successfully'
    });

  } catch (error) {
    console.error('Xero disconnect error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to disconnect Xero',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
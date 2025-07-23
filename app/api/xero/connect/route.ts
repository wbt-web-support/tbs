import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { XeroAPI } from '@/lib/xero-api';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    // Initialize Xero API with error handling
    let xeroAPI;
    try {
      xeroAPI = new XeroAPI(supabase);
    } catch (initError) {
      console.error('Failed to initialize Xero API:', initError);
      return NextResponse.json(
        { 
          error: 'Xero integration not configured', 
          details: initError instanceof Error ? initError.message : 'Configuration error'
        },
        { status: 500 }
      );
    }
    const existingConnections = await xeroAPI.getAllConnections(user.id);
    
    if (existingConnections.length > 0) {
      return NextResponse.json({ 
        error: 'Xero connection already exists. Please disconnect first if you want to reconnect.',
        connections: existingConnections.map(conn => ({
          tenant_id: conn.tenant_id,
          organization_name: conn.organization_name,
          sync_status: conn.sync_status
        }))
      }, { status: 400 });
    }

    // Generate state parameter for OAuth security
    const state = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(2)}`;

    // Generate OAuth authorization URL
    const authUrl = xeroAPI.generateAuthUrl(state);

    // Validate that authUrl is a string
    if (typeof authUrl !== 'string' || !authUrl.startsWith('http')) {
      console.error('Invalid authUrl generated:', authUrl);
      return NextResponse.json({ 
        error: 'Failed to generate valid authorization URL',
        details: 'Invalid URL format'
      }, { status: 500 });
    }

    return NextResponse.json({ 
      authUrl,
      state,
      message: 'Redirect to Xero for authorization' 
    });

  } catch (error) {
    console.error('Error initiating Xero connection:', error);
    return NextResponse.json({ 
      error: 'Failed to initiate Xero connection',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
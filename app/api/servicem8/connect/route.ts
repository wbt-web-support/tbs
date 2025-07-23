import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ServiceM8API } from '@/lib/servicem8-api';

export async function GET(request: NextRequest) {
  return handleConnect();
}

export async function POST(request: NextRequest) {
  return handleConnect();
}

async function handleConnect() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`Initiating ServiceM8 connection for user: ${user.id}`);

    // Check if required environment variables are set
    if (!process.env.SERVICEM8_CLIENT_ID) {
      return NextResponse.json({ 
        error: 'ServiceM8 integration is not configured. Missing SERVICEM8_CLIENT_ID environment variable.' 
      }, { status: 500 });
    }
    if (!process.env.SERVICEM8_CLIENT_SECRET) {
      return NextResponse.json({ 
        error: 'ServiceM8 integration is not configured. Missing SERVICEM8_CLIENT_SECRET environment variable.' 
      }, { status: 500 });
    }
    if (!process.env.SERVICEM8_REDIRECT_URI) {
      return NextResponse.json({ 
        error: 'ServiceM8 integration is not configured. Missing SERVICEM8_REDIRECT_URI environment variable.' 
      }, { status: 500 });
    }

    const serviceM8API = new ServiceM8API(supabase);
    
    // Generate unique state parameter for this user (using underscores to avoid UUID parsing issues)
    const state = `${user.id}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    // Get authorization URL
    const authUrl = serviceM8API.getAuthorizationUrl(user.id, state);
    
    console.log(`Generated ServiceM8 OAuth URL for user ${user.id}`);
    
    return NextResponse.json({ 
      authUrl,
      state 
    });

  } catch (error) {
    console.error('ServiceM8 connect error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json({ 
      error: 'Failed to generate ServiceM8 authorization URL',
      details: errorMessage 
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ServiceM8API } from '@/lib/servicem8-api';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
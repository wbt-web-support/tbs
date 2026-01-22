import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ServiceM8API } from '@/lib/servicem8-api';

export async function GET(request: NextRequest) {
  return handleConnect(request);
}

export async function POST(request: NextRequest) {
  return handleConnect(request);
}

async function handleConnect(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceM8API = new ServiceM8API(supabase);
    // Generate a secure state parameter
    const state = `${user.id}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    const authUrl = serviceM8API.getAuthorizationUrl(user.id, state);
    
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('ServiceM8 connect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

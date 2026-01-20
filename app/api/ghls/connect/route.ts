
import { NextRequest, NextResponse } from 'next/server';
import { GHLAPIService } from '@/lib/ghl-api';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  // GET requests should not be used for this endpoint
  // Redirect to the integrations page
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                 `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  
  return NextResponse.redirect(
    `${baseUrl}/integrations/ghl?error=${encodeURIComponent('Invalid request method. Please use the Connect button.')}`
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the base URL from environment or construct from request
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    // Create a state parameter to verify the response and pass user context
    const state = JSON.stringify({
      userId: user.id
    });
    
    // Generate encoded state
    const encodedState = Buffer.from(state).toString('base64');

    const redirectUri = `${baseUrl}/api/ghls/callback`;
    console.log('Generated redirect URI:', redirectUri);
    
    const authUrl = GHLAPIService.getAuthorizationUrl(redirectUri, encodedState);
    console.log('Generated auth URL:', authUrl);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error initiating GHL connection:', error);
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { GHLAPIService, saveGHLIntegration } from '@/lib/ghl-api';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  console.log('GHL OAuth callback received:', { 
    hasCode: !!code, 
    hasState: !!state, 
    hasError: !!error,
    error: error 
  });

  // Get base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                 `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  // Handle OAuth errors from GHL
  if (error) {
    console.error('GHL OAuth error:', error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    console.error('No authorization code received');
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=no_code`
    );
  }

  try {
    // Get the authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User authentication error:', userError);
      return NextResponse.redirect(
        `${baseUrl}/login?redirect_to=${encodeURIComponent('/integrations')}`
      );
    }

    console.log('OAuth callback - User authenticated:', user.id);

    // Verify state
    try {
      if (state) {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
        if (decodedState.userId !== user.id) {
          throw new Error('User mismatch');
        }
      }
    } catch (e) {
      console.error('State verification failed:', e);
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=invalid_state`
      );
    }

    // Exchange code for tokens
    const redirectUri = `${baseUrl}/api/ghls/callback`;
    console.log('Exchanging code for token with redirect URI:', redirectUri);
    
    const tokens = await GHLAPIService.exchangeCodeForToken(code, redirectUri);
    
    // CRITICAL: Log access token to console as requested by user
    console.log('--------------------------------------------------');
    console.log('🚀 SUCCESS: GHL ACCESS TOKEN RECEIVED');
    console.log('ACCESS TOKEN:', tokens.access_token);
    console.log('--------------------------------------------------');

    console.log('Token exchange successful, received data:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      companyId: tokens.companyId,
      userId: tokens.userId,
      userType: tokens.userType
    });

    // Get user's team_id to auto-scope the integration if applicable
    const { data: businessInfo } = await supabase
      .from('business_info')
      .select('team_id')
      .eq('user_id', user.id)
      .single();
    
    const teamId = businessInfo?.team_id;

    // Store the integration using new helper
    console.log('📝 Attempting to save GHL integration with data:', {
      userId: user.id,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      companyId: tokens.companyId,
      locationId: tokens.locationId,
      userType: tokens.userType,
      teamId: teamId
    });
    
    try {
      await saveGHLIntegration(user.id, tokens, teamId);
      console.log('✅ GHL integration saved successfully');
    } catch (saveError: any) {
      console.error('❌ Failed to save GHL integration:', saveError);
      console.error('Error details:', {
        message: saveError.message,
        code: saveError.code,
        details: saveError.details,
        hint: saveError.hint
      });
      throw saveError;
    }

    // Redirect back to integrations page with success
    return NextResponse.redirect(
      `${baseUrl}/integrations/ghl?success=true`
    );

  } catch (error: any) {
    console.error('GHL OAuth callback error:', error);
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent(
        error instanceof Error ? error.message : 'Connection failed'
      )}`
    );
  }
}

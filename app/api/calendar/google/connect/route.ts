import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Clean environment variable: remove quotes/backticks and trim whitespace (common .env file issues)
    const cleanEnvValue = (value: string | undefined) => {
      if (!value) return undefined;
      return value.trim().replace(/^["'`]|["'`]$/g, '').trim();
    };
    const clientId = cleanEnvValue(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
    
    if (!clientId) {
      return NextResponse.json(
        { error: 'Google OAuth is not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const redirectPath = searchParams.get('redirect') || '/calendar';
    const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/calendar.readonly'
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: `calendar_redirect=${encodeURIComponent(redirectPath)}`
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error initiating Google Calendar connection:', error);
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}


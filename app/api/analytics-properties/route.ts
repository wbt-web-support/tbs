import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountName = searchParams.get('account');
    
    if (!accountName) {
      return NextResponse.json(
        { error: 'Account name is required' },
        { status: 400 }
      );
    }

    // Get current user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get user's Google Analytics tokens
    const { data: tokenData, error } = await supabase
      .from('google_analytics_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (error || !tokenData) {
      return NextResponse.json(
        { error: 'No Google Analytics connection found' },
        { status: 404 }
      );
    }

    const { access_token } = tokenData;

    // Extract account ID from account name (e.g., "accounts/123456789" -> "123456789")
    const accountId = accountName.split('/').pop();
    
    // Fetch properties for the specified account using the correct endpoint
    const propertiesResponse = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:accounts/${accountId}`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!propertiesResponse.ok) {
      const errorText = await propertiesResponse.text();
      console.error('Properties API Error:', {
        status: propertiesResponse.status,
        statusText: propertiesResponse.statusText,
        accountName,
        accountId,
        url: `https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:accounts/${accountId}`,
        errorText
      });
      
      return NextResponse.json({
        error: `Failed to fetch properties: ${propertiesResponse.status} ${propertiesResponse.statusText}`,
        details: errorText,
        accountName,
        accountId,
        endpoint: `https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:accounts/${accountId}`,
        properties: []
      });
    }
    
    const propertiesData = await propertiesResponse.json();
    
    return NextResponse.json({
      account: accountName,
      properties: propertiesData.properties || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Properties API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch properties data' },
      { status: 500 }
    );
  }
} 
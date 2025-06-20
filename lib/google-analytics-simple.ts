import { createClient } from '@/utils/supabase/server';

export interface GoogleAnalyticsRawData {
  connected: boolean;
  accountName?: string;
  propertyId?: string;
  rawData?: any;
  error?: string;
}

export async function fetchGoogleAnalyticsRawData(userId: string): Promise<GoogleAnalyticsRawData> {
  try {
    const supabase = await createClient();
    
    // Get user's Google Analytics tokens
    const { data: tokenData, error } = await supabase
      .from('google_analytics_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !tokenData) {
      return {
        connected: false,
        error: 'No Google Analytics connection found'
      };
    }
    
    const { access_token, account_name, property_id } = tokenData;
    
    // Fetch Google Analytics accounts first
    const accountsResponse = await fetch('https://analyticsadmin.googleapis.com/v1beta/accounts', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!accountsResponse.ok) {
      return {
        connected: true,
        accountName: account_name,
        error: `Failed to fetch accounts: ${accountsResponse.status} ${accountsResponse.statusText}`,
        rawData: {
          tokenExists: true,
          accessTokenExists: !!access_token,
          responseStatus: accountsResponse.status,
          responseText: await accountsResponse.text()
        }
      };
    }
    
    const accountsData = await accountsResponse.json();
    
    // Fetch properties for the first account
    let propertiesData = null;
    if (accountsData.accounts && accountsData.accounts.length > 0) {
      const firstAccount = accountsData.accounts[0];
      const propertiesResponse = await fetch(`https://analyticsadmin.googleapis.com/v1beta/${firstAccount.name}/properties`, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (propertiesResponse.ok) {
        propertiesData = await propertiesResponse.json();
      }
    }
    
    return {
      connected: true,
      accountName: account_name,
      propertyId: property_id || 'not_set',
      rawData: {
        tokenInfo: {
          hasAccessToken: !!access_token,
          accountName: account_name,
          propertyId: property_id
        },
        accounts: accountsData,
        properties: propertiesData,
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error('Error fetching Google Analytics data:', error);
    return {
      connected: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
} 
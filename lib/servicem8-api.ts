import { createClient } from '@/utils/supabase/server';

interface ServiceM8Job {
  uuid: string;
  job_number: string;
  job_date: string;
  completed_date?: string;
  status: string;
  company_uuid: string;
  staff_uuid: string;
  total: number;
  description: string;
}

interface ServiceM8Staff {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  active: boolean;
}

interface ServiceM8Company {
  uuid: string;
  name: string;
  email: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  suburb: string;
  state: string;
  postcode: string;
}

interface ServiceM8JobActivity {
  uuid: string;
  job_uuid: string;
  staff_uuid: string;
  start_time: string;
  end_time?: string;
  description: string;
}

interface ServiceM8JobMaterial {
  uuid: string;
  job_uuid: string;
  material_uuid: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  description: string;
}

interface ServiceM8Connection {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  tenant_id?: string;
  organization_name?: string;
  scopes?: string;
}

export class ServiceM8API {
  private config = {
    baseUrl: process.env.SERVICEM8_BASE_URL || 'https://api.servicem8.com/api_1.0',
    authUrl: process.env.SERVICEM8_AUTH_URL || 'https://go.servicem8.com/oauth/authorize',
    tokenUrl: process.env.SERVICEM8_TOKEN_URL || 'https://go.servicem8.com/oauth/access_token',
    clientId: process.env.SERVICEM8_CLIENT_ID!,
    clientSecret: process.env.SERVICEM8_CLIENT_SECRET!,
    redirectUri: process.env.SERVICEM8_REDIRECT_URI!,
    scope: process.env.SERVICEM8_SCOPE || 'read_jobs read_staff read_customers read_schedule read_inventory',
  };

  constructor(private supabase?: any) {
    // Validate required environment variables
    if (!this.config.clientId) {
      throw new Error('SERVICEM8_CLIENT_ID environment variable is required');
    }
    if (!this.config.clientSecret) {
      throw new Error('SERVICEM8_CLIENT_SECRET environment variable is required');
    }
    if (!this.config.redirectUri) {
      throw new Error('SERVICEM8_REDIRECT_URI environment variable is required');
    }
  }

  private async getSupabaseClient() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }

  // Generate OAuth authorization URL for a specific user
  getAuthorizationUrl(userId: string, state?: string): string {
    const stateParam = state || `${userId}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      scope: this.config.scope,
      redirect_uri: this.config.redirectUri,
      state: stateParam,
    });

    return `${this.config.authUrl}?${params.toString()}`;
  }

  // Exchange authorization code for access tokens
  async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    console.log('Exchanging ServiceM8 authorization code for tokens...');
    
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.config.redirectUri
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ServiceM8 token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`ServiceM8 token exchange failed: ${response.status} - ${errorText}`);
    }

    const tokens = await response.json();
    console.log('✓ ServiceM8 tokens obtained successfully');
    return tokens;
  }

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    console.log('Refreshing ServiceM8 access token...');
    
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ServiceM8 token refresh failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`ServiceM8 token refresh failed: ${response.status} - ${errorText}`);
    }

    const tokens = await response.json();
    console.log('✓ ServiceM8 access token refreshed successfully');
    return tokens;
  }

  // Get ServiceM8 company information (similar to Xero's organizations)
  async getCompanyInfo(accessToken: string): Promise<ServiceM8Company> {
    const response = await fetch(`${this.config.baseUrl}/company.json?$top=1`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get ServiceM8 company info: ${response.statusText}`);
    }

    const companies = await response.json();
    if (!companies || companies.length === 0) {
      throw new Error('No ServiceM8 company found');
    }

    return companies[0];
  }

  // Store OAuth connection in database for a specific user
  async storeConnection(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    organizationName?: string,
    tenantId?: string
  ): Promise<void> {
    const supabase = await this.getSupabaseClient();
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const { error } = await supabase
      .from('servicem8_data')
      .upsert({
        user_id: userId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt.toISOString(),
        tenant_id: tenantId,
        organization_name: organizationName,
        scopes: this.config.scope,
        connected_at: new Date().toISOString(),
        sync_status: 'pending',
        // Clear legacy API key fields
        api_key: null,
      });

    if (error) {
      console.error('Failed to store ServiceM8 connection:', error);
      throw new Error(`Failed to store ServiceM8 connection: ${error.message}`);
    }

    console.log('✓ ServiceM8 OAuth connection stored successfully');
  }

  // Get valid access token for a user (with automatic refresh)
  async getValidAccessToken(userId: string): Promise<string> {
    const supabase = await this.getSupabaseClient();

    // Get the stored connection
    const { data, error } = await supabase
      .from('servicem8_data')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new Error('No ServiceM8 connection found for this user');
    }

    if (!data.access_token || !data.refresh_token) {
      throw new Error('Invalid ServiceM8 connection - missing tokens');
    }

    // Check if token is expired (with 5-minute buffer)
    const expiresAt = new Date(data.expires_at);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds

    if (expiresAt.getTime() - now.getTime() <= bufferTime) {
      console.log('ServiceM8 access token expired, refreshing...');
      
      try {
        const tokens = await this.refreshAccessToken(data.refresh_token);
        
        // Update stored tokens
        const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
        await supabase
          .from('servicem8_data')
          .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: newExpiresAt.toISOString(),
          })
          .eq('user_id', userId);

        return tokens.access_token;
      } catch (refreshError) {
        console.error('Failed to refresh ServiceM8 token:', refreshError);
        throw new Error('ServiceM8 token expired and refresh failed. Please reconnect your account.');
      }
    }

    return data.access_token;
  }

  // Check if user has active ServiceM8 connection
  async isConnected(userId: string): Promise<boolean> {
    const supabase = await this.getSupabaseClient();

    const { data } = await supabase
      .from('servicem8_data')
      .select('connected_at, access_token, refresh_token')
      .eq('user_id', userId)
      .single();

    return !!(data?.connected_at && data?.access_token && data?.refresh_token);
  }

  // Get connection info for a user
  async getConnectionInfo(userId: string): Promise<ServiceM8Connection | null> {
    const supabase = await this.getSupabaseClient();

    const { data } = await supabase
      .from('servicem8_data')
      .select('access_token, refresh_token, expires_at, tenant_id, organization_name, scopes')
      .eq('user_id', userId)
      .single();

    if (!data || !data.access_token) {
      return null;
    }

    return data;
  }

  // Make authenticated API request for a specific user
  private async makeAuthenticatedRequest(userId: string, endpoint: string): Promise<any> {
    const accessToken = await this.getValidAccessToken(userId);
    
    console.log(`Making ServiceM8 API request to: ${this.config.baseUrl}${endpoint}`);
    
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      throw new Error('ServiceM8 authentication failed. Please reconnect your account.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ServiceM8 API error for ${endpoint}:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`ServiceM8 API error: ${response.status} - ${response.statusText}`);
    }

    return response.json();
  }

  // API methods for specific user
  async getJobs(userId: string): Promise<ServiceM8Job[]> {
    return this.makeAuthenticatedRequest(userId, '/job.json');
  }

  async getStaff(userId: string): Promise<ServiceM8Staff[]> {
    try {
      return await this.makeAuthenticatedRequest(userId, '/staff.json');
    } catch (error) {
      console.log('Trying alternative staff endpoint: /technician.json');
      try {
        return await this.makeAuthenticatedRequest(userId, '/technician.json');
      } catch (error2) {
        console.log('Trying alternative staff endpoint: /employee.json');
        return await this.makeAuthenticatedRequest(userId, '/employee.json');
      }
    }
  }

  async getCompanies(userId: string): Promise<ServiceM8Company[]> {
    return this.makeAuthenticatedRequest(userId, '/company.json');
  }

  async getJobActivities(userId: string): Promise<ServiceM8JobActivity[]> {
    return this.makeAuthenticatedRequest(userId, '/jobactivity.json');
  }

  async getJobMaterials(userId: string): Promise<ServiceM8JobMaterial[]> {
    return this.makeAuthenticatedRequest(userId, '/job_material.json');
  }

  // Get all data for a specific user
  async getAllData(userId: string) {
    console.log(`Fetching ServiceM8 data for user: ${userId}`);
    
    try {
      console.log('Fetching jobs...');
      const jobs = await this.getJobs(userId);
      console.log(`✓ Jobs: ${jobs.length} records`);

      console.log('Fetching companies...');
      const companies = await this.getCompanies(userId);
      console.log(`✓ Companies: ${companies.length} records`);

      let staff = [];
      try {
        console.log('Fetching staff...');
        staff = await this.getStaff(userId);
        console.log(`✓ Staff: ${staff.length} records`);
      } catch (error) {
        console.warn('Staff endpoint failed:', error.message);
      }

      // Skip potentially problematic endpoints for now
      const jobActivities = [];
      const jobMaterials = [];

      return {
        jobs,
        staff,
        companies,
        job_activities: jobActivities,
        job_materials: jobMaterials,
      };
    } catch (error) {
      console.error(`Error in getAllData for user ${userId}:`, error);
      throw error;
    }
  }

  // Disconnect ServiceM8 for a specific user
  async disconnect(userId: string): Promise<void> {
    try {
      const supabase = await this.getSupabaseClient();

      console.log(`Attempting to disconnect ServiceM8 for user: ${userId}`);

      const { error } = await supabase
        .from('servicem8_data')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('ServiceM8 disconnect database error:', error);
        throw new Error(`Failed to delete ServiceM8 connection: ${error.message}`);
      }

      console.log(`✓ ServiceM8 connection disconnected for user: ${userId}`);
    } catch (error) {
      console.error('ServiceM8 disconnect error:', error);
      throw error;
    }
  }
}
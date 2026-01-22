import { createClient } from '@/utils/supabase/server';

interface ServiceM8Job {
  uuid: string;
  job_number: string;
  generated_job_id: string;
  status: string;
  date: string;
  completion_date: string;
  total_invoice_amount: string;
  payment_amount: string;
  payment_method: string;
  payment_received: string;
  payment_processed: string;
  payment_received_stamp: string;
  payment_processed_stamp: string;
  invoice_sent: string;
  invoice_sent_stamp: string;
  ready_to_invoice: string;
  ready_to_invoice_stamp: string;
  quote_date: string;
  quote_sent: string;
  quote_sent_stamp: string;
  work_order_date: string;
  company_uuid: string;
  category_uuid: string;
  created_by_staff_uuid: string;
  job_address: string;
  billing_address: string;
  job_description: string;
  work_done_description: string;
  purchase_order_number: string;
  badges: string;
  active: number;
}

interface ServiceM8Staff {
  uuid: string;
  first: string;
  last: string;
  email: string;
  mobile: string;
  job_title: string;
  color: string;
  status_message: string;
  hide_from_schedule: string;
  active: number;
}

interface ServiceM8Company {
  uuid: string;
  name: string;
  abn_number: string;
  address: string;
  billing_address: string;
  email: string;
  phone: string;
  website: string;
  is_individual: string;
  fax_number: string;
  badges: string;
  payment_terms: string;
  active: number;
}

interface ServiceM8Category {
  uuid: string;
  name: string;
  color: string;
  active: number;
}

interface ServiceM8Contact {
  uuid: string;
  company_uuid: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  mobile: string;
  type: string;
  is_primary_contact: string;
  active: number;
}

interface ServiceM8JobContact {
  uuid: string;
  job_uuid: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  mobile: string;
  type: string;
  active: number;
}

interface ServiceM8Activity {
  uuid: string;
  job_uuid: string;
  staff_uuid: string;
  start_date: string;
  end_date: string;
  travel_time_in_seconds: string;
  travel_distance_in_meters: string;
  activity_was_scheduled: string;
  activity_was_recorded: string;
  activity_was_automated: string;
  has_been_opened: string;
  has_been_opened_timestamp: string;
  active: number;
}

interface ServiceM8Payment {
  uuid: string;
  job_uuid: string;
  amount: string;
  timestamp: string;
  method: string;
  note: string;
  actioned_by_uuid: string;
  is_deposit: string;
  active: number;
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
    scope: (process.env.SERVICEM8_SCOPE || 'read_jobs read_staff read_customers read_schedule read_inventory read_job_payments read_job_materials read_job_categories read_customer_contacts read_job_contacts staff_activity').replace(/^"|"$/g, ''),
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

  /**
   * Helper to ensure UUIDs are valid or null (converts empty strings to null)
   */
  private sanitizeUUID(uuid: string | undefined | null): string | null {
    if (!uuid || uuid.trim() === '' || uuid === '00000000-0000-0000-0000-000000000000') {
      return null;
    }
    return uuid;
  }

  /**
   * Helper to ensure dates are valid (converts "0000-00-00 00:00:00" or empty to null)
   */
  /**
   * Helper to ensure dates are valid (converts "0000-00-00 00:00:00" or empty to null)
   */
  private sanitizeDate(dateStr: string | undefined | null): string | null {
    if (!dateStr || dateStr.trim() === '' || dateStr.startsWith('0000-00-00')) {
      return null;
    }
    return dateStr;
  }

  /**
   * Helper to parse boolean from API 
   */
  private sanitizeBoolean(val: string | number | boolean | undefined): boolean {
    if (val === undefined || val === null) return true; // Default to true if missing? or false. Schema defaults true.
    if (typeof val === 'number') return val === 1;
    if (typeof val === 'string') return val === '1' || val.toLowerCase() === 'true';
    return val === true;
  }

  // Generate OAuth authorization URL for a specific user
  getAuthorizationUrl(userId: string, state?: string): string {
    const stateParam = state || `${userId}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    console.log('🔍 ServiceM8 OAuth Scopes being requested:', this.config.scope);
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      scope: this.config.scope,
      redirect_uri: this.config.redirectUri,
      state: stateParam,
    });

    const authUrl = `${this.config.authUrl}?${params.toString()}`;
    console.log('🔗 ServiceM8 Authorization URL:', authUrl);
    
    return authUrl;
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

    const tokens = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };
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

    const tokens = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };
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

  // Make authenticated API request for a specific user with basic retry logic
  private async makeAuthenticatedRequest(userId: string, endpoint: string, manualAccessToken?: string, retries = 2): Promise<any> {
    let accessToken = manualAccessToken || await this.getValidAccessToken(userId);
    
    for (let i = 0; i <= retries; i++) {
      try {
        console.log(`Making ServiceM8 API request to: ${this.config.baseUrl}${endpoint} (Attempt ${i + 1})`);
        
        const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 401 && i < retries) {
          console.warn('ServiceM8 status 401, attempting token refresh...');
          // Force refresh by getting a fresh token if it wasn't manual
          if (!manualAccessToken) {
            accessToken = await this.getValidAccessToken(userId);
            continue;
          }
        }

        if (response.status === 429 || (response.status >= 500 && i < retries)) {
          const waitTime = Math.pow(2, i) * 1000;
          console.warn(`ServiceM8 error ${response.status}, retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
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
      } catch (error) {
        if (i === retries) throw error;
        console.warn(`Request attempt ${i + 1} failed, retrying...`, error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // API methods for specific user
  async getJobs(userId: string, accessToken?: string): Promise<ServiceM8Job[]> {
    return this.makeAuthenticatedRequest(userId, '/job.json', accessToken);
  }

  async getStaff(userId: string, accessToken?: string): Promise<ServiceM8Staff[]> {
    try {
      return await this.makeAuthenticatedRequest(userId, '/staff.json', accessToken);
    } catch (error) {
      console.log('Trying alternative staff endpoint: /technician.json');
      try {
        return await this.makeAuthenticatedRequest(userId, '/technician.json', accessToken);
      } catch (error2) {
        console.log('Trying alternative staff endpoint: /employee.json');
        return await this.makeAuthenticatedRequest(userId, '/employee.json', accessToken);
      }
    }
  }

  async getCompanies(userId: string, accessToken?: string): Promise<ServiceM8Company[]> {
    return this.makeAuthenticatedRequest(userId, '/company.json', accessToken);
  }

  async getJobMaterials(userId: string, accessToken?: string): Promise<ServiceM8JobMaterial[]> {
    return this.makeAuthenticatedRequest(userId, '/jobmaterial.json', accessToken);
  }

  async getPayments(userId: string, accessToken?: string): Promise<ServiceM8Payment[]> {
    return this.makeAuthenticatedRequest(userId, '/jobpayment.json', accessToken);
  }

  async getCategories(userId: string, accessToken?: string): Promise<ServiceM8Category[]> {
    return this.makeAuthenticatedRequest(userId, '/category.json', accessToken);
  }

  async getCompanyContacts(userId: string, accessToken?: string): Promise<ServiceM8Contact[]> {
    return this.makeAuthenticatedRequest(userId, '/companycontact.json', accessToken);
  }

  async getJobContacts(userId: string, accessToken?: string): Promise<ServiceM8JobContact[]> {
    return this.makeAuthenticatedRequest(userId, '/jobcontact.json', accessToken);
  }

  async getJobActivities(userId: string, accessToken?: string): Promise<ServiceM8Activity[]> {
    return this.makeAuthenticatedRequest(userId, '/jobactivity.json', accessToken);
  }

  // Get all data for a specific user
  async getAllData(userId: string, accessToken?: string) {
    console.log(`Fetching ServiceM8 data for user: ${userId}`);
    
    try {
      console.log('Fetching companies...');
      const companies = await this.getCompanies(userId, accessToken);
      console.log(`✓ Companies: ${companies.length} records`);

      console.log('Fetching categories...');
      let categories: ServiceM8Category[] = [];
      try {
        categories = await this.getCategories(userId, accessToken);
        console.log(`✓ Categories: ${categories.length} records`);
      } catch (error) {
        console.warn('Categories endpoint failed:', error instanceof Error ? error.message : String(error));
      }

      console.log('Fetching staff...');
      let staff: ServiceM8Staff[] = [];
      try {
        staff = await this.getStaff(userId, accessToken);
        console.log(`✓ Staff: ${staff.length} records`);
      } catch (error) {
        console.warn('Staff endpoint failed:', error instanceof Error ? error.message : String(error));
      }

      console.log('Fetching jobs...');
      const jobs = await this.getJobs(userId, accessToken);
      console.log(`✓ Jobs: ${Array.isArray(jobs) ? jobs.length : 'not an array'} records`);
      if (jobs && jobs.length > 0) console.log('First job sample:', JSON.stringify(jobs[0]).substring(0, 200));

      console.log('Fetching company contacts...');
      let companyContacts: ServiceM8Contact[] = [];
      try {
        companyContacts = await this.getCompanyContacts(userId, accessToken);
        console.log(`✓ Company Contacts: ${companyContacts.length} records`);
      } catch (error) {
        console.warn('Company Contacts endpoint failed:', error instanceof Error ? error.message : String(error));
      }

      console.log('Fetching job contacts...');
      let jobContacts: ServiceM8JobContact[] = [];
      try {
        jobContacts = await this.getJobContacts(userId, accessToken);
        console.log(`✓ Job Contacts: ${jobContacts.length} records`);
      } catch (error) {
        console.warn('Job Contacts endpoint failed:', error instanceof Error ? error.message : String(error));
      }

      console.log('Fetching job activities...');
      let jobActivities: ServiceM8Activity[] = [];
      try {
        jobActivities = await this.getJobActivities(userId, accessToken);
        console.log(`✓ Activities: ${jobActivities.length} records`);
      } catch (error) {
        console.warn('Job Activities endpoint failed:', error instanceof Error ? error.message : String(error));
      }

      console.log('Fetching job materials...');
      let jobMaterials: ServiceM8JobMaterial[] = [];
      try {
        jobMaterials = await this.getJobMaterials(userId, accessToken);
        console.log(`✓ Materials: ${jobMaterials.length} records`);
      } catch (error) {
        console.warn('Job Materials endpoint failed:', error instanceof Error ? error.message : String(error));
      }

      console.log('Fetching payments...');
      let payments: ServiceM8Payment[] = [];
      try {
        payments = await this.getPayments(userId, accessToken);
        console.log(`✓ Payments: ${payments.length} records`);
      } catch (error) {
        console.warn('Payments endpoint failed:', error instanceof Error ? error.message : String(error));
      }

      return {
        jobs,
        staff,
        companies,
        job_activities: jobActivities,
        job_materials: jobMaterials,
        payments,
        categories,
        company_contacts: companyContacts,
        job_contacts: jobContacts
      };
    } catch (error) {
      console.error(`Error in getAllData for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Performs a complete relational sync for a user
   */
  async performRelationalSync(userId: string, accessToken?: string) {
    const supabase = await this.getSupabaseClient();
    
    // 1. Fetch all data
    const data = await this.getAllData(userId, accessToken);
    let syncErrors: string[] = [];

    // 2. Perform Batch Upserts
    
    // 2.1 Sync Companies (Clients)
    try {
      if (data.companies.length > 0) {
        const companiesToUpsert = data.companies.map(c => ({
          uuid: this.sanitizeUUID(c.uuid)!,
          user_id: userId,
          name: c.name,
          address: c.address,
          billing_address: c.billing_address,
          email: c.email,
          phone: c.phone,
          abn_number: c.abn_number,
          is_individual: c.is_individual,
          website: c.website,
          fax_number: c.fax_number,
          badges: c.badges,
          payment_terms: c.payment_terms,
          active: this.sanitizeBoolean(c.active),
          updated_at: new Date().toISOString()
        }));
        
        const { error } = await supabase.from('servicem8_companies').upsert(companiesToUpsert);
        if (error) {
          console.error('Error syncing companies:', error);
          syncErrors.push(`Companies: ${error.message}`);
        } else console.log(`✓ Synced ${companiesToUpsert.length} companies`);
      }
    } catch (e) { 
      console.error('Error syncing companies:', e);
      syncErrors.push(`Companies sync exception: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 2.2 Sync Categories
    try {
      if (data.categories.length > 0) {
        const categoriesToUpsert = data.categories.map(c => ({
          uuid: this.sanitizeUUID(c.uuid)!,
          user_id: userId,
          name: c.name,
          color: c.color,
          active: this.sanitizeBoolean(c.active),
          updated_at: new Date().toISOString()
        }));

        const { error } = await supabase.from('servicem8_categories').upsert(categoriesToUpsert);
        if (error) {
          console.error('Error syncing categories:', error);
          syncErrors.push(`Categories: ${error.message}`);
        } else console.log(`✓ Synced ${categoriesToUpsert.length} categories`);
      }
    } catch (e) { 
      console.error('Error syncing categories:', e);
      syncErrors.push(`Categories sync exception: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 2.3 Sync Staff
    try {
      if (data.staff.length > 0) {
        const staffToUpsert = data.staff.map(s => ({
          uuid: this.sanitizeUUID(s.uuid)!,
          user_id: userId,
          first_name: s.first,
          last_name: s.last,
          email: s.email,
          mobile: s.mobile,
          job_title: s.job_title,
          color: s.color,
          status_message: s.status_message,
          hide_from_schedule: s.hide_from_schedule,
          active: this.sanitizeBoolean(s.active),
          updated_at: new Date().toISOString()
        }));

        const { error } = await supabase.from('servicem8_staff').upsert(staffToUpsert);
        if (error) {
          console.error('Error syncing staff:', error);
          syncErrors.push(`Staff: ${error.message}`);
        } else console.log(`✓ Synced ${staffToUpsert.length} staff`);
      }
    } catch (e) { 
      console.error('Error syncing staff:', e);
      syncErrors.push(`Staff sync exception: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 2.4 Sync Jobs
    try {
      if (data.jobs && Array.isArray(data.jobs) && data.jobs.length > 0) {
        const jobsToUpsert = data.jobs.map(j => ({
          uuid: this.sanitizeUUID(j.uuid)!,
          user_id: userId,
          job_number: j.job_number,
          generated_job_id: j.generated_job_id,
          status: j.status,
          date: this.sanitizeDate(j.date),
          completion_date: this.sanitizeDate(j.completion_date),
          total_invoice_amount: parseFloat(j.total_invoice_amount || '0'),
          payment_amount: parseFloat(j.payment_amount || '0'),
          payment_method: j.payment_method,
          payment_received: j.payment_received,
          payment_processed: j.payment_processed,
          payment_received_stamp: this.sanitizeDate(j.payment_received_stamp),
          payment_processed_stamp: this.sanitizeDate(j.payment_processed_stamp),
          invoice_sent: j.invoice_sent,
          invoice_sent_stamp: this.sanitizeDate(j.invoice_sent_stamp),
          ready_to_invoice: j.ready_to_invoice,
          ready_to_invoice_stamp: this.sanitizeDate(j.ready_to_invoice_stamp),
          quote_date: this.sanitizeDate(j.quote_date),
          quote_sent: j.quote_sent,
          quote_sent_stamp: this.sanitizeDate(j.quote_sent_stamp),
          work_order_date: this.sanitizeDate(j.work_order_date),
          company_uuid: this.sanitizeUUID(j.company_uuid),
          category_uuid: this.sanitizeUUID(j.category_uuid),
          created_by_staff_uuid: this.sanitizeUUID(j.created_by_staff_uuid),
          job_address: j.job_address,
          billing_address: j.billing_address,
          job_description: j.job_description,
          work_done_description: j.work_done_description,
          purchase_order_number: j.purchase_order_number,
          badges: j.badges,
          active: this.sanitizeBoolean(j.active),
          updated_at: new Date().toISOString()
        }));

        const { error } = await supabase.from('servicem8_jobs').upsert(jobsToUpsert);
        if (error) {
          console.error('Error syncing jobs:', error);
          syncErrors.push(`Jobs: ${error.message}`);
        } else console.log(`✓ Synced ${jobsToUpsert.length} jobs`);
      }
    } catch (e) { 
      console.error('Error syncing jobs:', e);
      syncErrors.push(`Jobs sync exception: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 2.5 Sync Company Contacts
    try {
      if (data.company_contacts.length > 0) {
        const contactsToUpsert = data.company_contacts.map(c => ({
          uuid: this.sanitizeUUID(c.uuid)!,
          user_id: userId,
          company_uuid: this.sanitizeUUID(c.company_uuid),
          first_name: c.first,
          last_name: c.last,
          email: c.email,
          phone: c.phone,
          mobile: c.mobile,
          type: c.type,
          is_primary_contact: c.is_primary_contact,
          active: this.sanitizeBoolean(c.active),
          updated_at: new Date().toISOString()
        }));

        const { error } = await supabase.from('servicem8_contacts').upsert(contactsToUpsert);
        if (error) console.error('Error syncing company contacts:', error);
        else console.log(`✓ Synced ${contactsToUpsert.length} company contacts`);
      }
    } catch (e) { console.error('Error syncing company contacts:', e); }

    // 2.6 Sync Job Contacts
    try {
      if (data.job_contacts.length > 0) {
        // First, get all successfully synced job UUIDs from the database
        const { data: existingJobs } = await supabase
          .from('servicem8_jobs')
          .select('uuid')
          .eq('user_id', userId);
        
        const existingJobUUIDs = new Set(existingJobs?.map((j: any) => j.uuid) || []);
        
        // Only insert job contacts for jobs that exist
        const jobContactsToUpsert = data.job_contacts
          .filter(c => {
            const jobUuid = this.sanitizeUUID(c.job_uuid);
            if (!jobUuid || !existingJobUUIDs.has(jobUuid)) {
              console.warn(`Skipping job contact ${c.uuid} - parent job ${c.job_uuid} not found`);
              return false;
            }
            return true;
          })
          .map(c => ({
            uuid: this.sanitizeUUID(c.uuid)!,
            user_id: userId,
            job_uuid: this.sanitizeUUID(c.job_uuid),
            first_name: c.first,
            last_name: c.last,
            email: c.email,
            phone: c.phone,
            mobile: c.mobile,
            type: c.type,
            active: this.sanitizeBoolean(c.active),
            updated_at: new Date().toISOString()
          }));

        if (jobContactsToUpsert.length > 0) {
          const { error } = await supabase.from('servicem8_job_contacts').upsert(jobContactsToUpsert);
          if (error) {
            console.error('Error syncing job contacts:', error);
            syncErrors.push(`Job Contacts: ${error.message}`);
          } else {
            console.log(`✓ Synced ${jobContactsToUpsert.length} job contacts (${data.job_contacts.length - jobContactsToUpsert.length} skipped due to missing parent jobs)`);
          }
        } else {
          console.warn('No valid job contacts to sync - all parent jobs missing');
        }
      }
    } catch (e) { console.error('Error syncing job contacts:', e); }

    // 2.7 Sync Activities
    try {
      if (data.job_activities.length > 0) {
        const activitiesToUpsert = data.job_activities.map(a => ({
          uuid: this.sanitizeUUID(a.uuid)!,
          user_id: userId,
          job_uuid: this.sanitizeUUID(a.job_uuid),
          staff_uuid: this.sanitizeUUID(a.staff_uuid),
          start_date: this.sanitizeDate(a.start_date),
          end_date: this.sanitizeDate(a.end_date),
          travel_time_in_seconds: parseInt(a.travel_time_in_seconds || '0'),
          travel_distance_in_meters: parseInt(a.travel_distance_in_meters || '0'),
          activity_was_scheduled: a.activity_was_scheduled,
          activity_was_recorded: a.activity_was_recorded,
          activity_was_automated: a.activity_was_automated,
          has_been_opened: a.has_been_opened,
          has_been_opened_timestamp: this.sanitizeDate(a.has_been_opened_timestamp),
          active: this.sanitizeBoolean(a.active),
          updated_at: new Date().toISOString()
        }));

        const { error } = await supabase.from('servicem8_job_activities').upsert(activitiesToUpsert);
        if (error) {
          console.error('Supabase activities upsert error:', error);
          syncErrors.push(`Activities: ${error.message}`);
        } else console.log('✓ Activities upserted successfully');
      } else {
        console.log('No activities found to sync');
      }
    } catch (e) { console.error('Error syncing activities:', e); }

    // 2.8 Sync Payments
    try {
      if (data.payments.length > 0) {
        const paymentsToUpsert = data.payments.map(p => ({
          uuid: this.sanitizeUUID(p.uuid)!,
          user_id: userId,
          job_uuid: this.sanitizeUUID(p.job_uuid),
          amount: parseFloat(p.amount || '0'),
          timestamp: this.sanitizeDate(p.timestamp),
          method: p.method,
          note: p.note,
          actioned_by_uuid: this.sanitizeUUID(p.actioned_by_uuid),
          is_deposit: p.is_deposit,
          active: this.sanitizeBoolean(p.active),
          updated_at: new Date().toISOString()
        }));

        const { error } = await supabase.from('servicem8_job_payments').upsert(paymentsToUpsert);
        if (error) {
          console.error('Supabase payments upsert error:', error);
          syncErrors.push(`Payments: ${error.message}`);
        } else console.log('✓ Payments upserted successfully');
      } else {
        console.log('No payments found to sync');
      }
    } catch (e) { console.error('Error syncing payments:', e); }

    // 3. Update Sync Metadata
    const finalSyncStatus = syncErrors.length > 0 ? (syncErrors.length < 5 ? 'partial' : 'error') : 'completed';
    const finalErrorMessage = syncErrors.length > 0 ? syncErrors.join('; ') : null;

    await supabase.from('servicem8_data').update({
      sync_status: finalSyncStatus,
      last_sync_at: new Date().toISOString(),
      error_message: finalErrorMessage
    }).eq('user_id', userId);

    return data;
  }




  // Disconnect ServiceM8 for a specific user
  async disconnect(userId: string): Promise<void> {
    try {
      const supabase = await this.getSupabaseClient();
      const { error } = await supabase
        .from('servicem8_data')
        .delete()
        .eq('user_id', userId);

      if (error) throw new Error(`Failed to delete ServiceM8 connection: ${error.message}`);
    } catch (error) {
      console.error('ServiceM8 disconnect error:', error);
      throw error;
    }
  }
}

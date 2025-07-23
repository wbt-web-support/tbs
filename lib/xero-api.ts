import { XeroApi, XeroClient } from 'xero-node';
import { createClient } from '@/utils/supabase/server';

export interface XeroConnection {
  id: string;
  user_id: string;
  tenant_id: string;
  organization_name: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  connected_at: string;
  last_sync_at: string | null;
  sync_status: 'pending' | 'syncing' | 'completed' | 'error';
  error_message: string | null;
  invoices: any[];
  contacts: any[];
  accounts: any[];
  bank_transactions: any[];
}

export interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  Type: string;
  Status: string;
  Date: string;
  DueDate: string;
  SubTotal: number;
  TotalTax: number;
  Total: number;
  Contact: {
    ContactID: string;
    Name: string;
  };
}

export interface XeroContact {
  ContactID: string;
  Name: string;
  EmailAddress: string;
  Addresses: any[];
  Phones: any[];
  ContactStatus: string;
  IsSupplier: boolean;
  IsCustomer: boolean;
}

export interface XeroAccount {
  AccountID: string;
  Code: string;
  Name: string;
  Type: string;
  Class: string;
  Status: string;
  BankAccountNumber?: string;
  CurrencyCode: string;
}

export interface XeroBankTransaction {
  BankTransactionID: string;
  BankAccount: {
    AccountID: string;
    Name: string;
  };
  Type: string;
  Status: string;
  Date: string;
  Reference: string;
  Total: number;
  Contact: {
    ContactID: string;
    Name: string;
  };
}

export class XeroAPI {
  private client: XeroClient;
  private config: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
    tokenUrl: string;
    baseUrl: string;
  };

  constructor(private supabaseClient?: any) {
    this.config = {
      clientId: process.env.XERO_CLIENT_ID || '',
      clientSecret: process.env.XERO_CLIENT_SECRET || '',
      redirectUri: process.env.XERO_REDIRECT_URI || 'http://localhost:3000/api/xero/callback',
      scopes: ['openid', 'profile', 'email', 'accounting.transactions', 'accounting.reports.read', 'accounting.settings', 'offline_access'],
      tokenUrl: 'https://identity.xero.com/connect/token',
      baseUrl: 'https://api.xero.com/api.xro/2.0'
    };

    // Validate required environment variables
    if (!this.config.clientId || !this.config.clientSecret) {
      console.error('Missing Xero environment variables: XERO_CLIENT_ID and XERO_CLIENT_SECRET are required');
      throw new Error('Xero credentials not configured. Please set XERO_CLIENT_ID and XERO_CLIENT_SECRET environment variables.');
    }

    try {
      this.client = new XeroClient({
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        redirectUris: [this.config.redirectUri],
        scopes: this.config.scopes,
        httpTimeout: 3000
      });
    } catch (error) {
      console.error('Failed to initialize Xero client:', error);
      throw new Error('Failed to initialize Xero client. Please check your Xero configuration.');
    }
  }

  private async getSupabaseClient() {
    if (!this.supabaseClient) {
      this.supabaseClient = await createClient();
    }
    return this.supabaseClient;
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(state: string): string {
    // Use manual URL construction to avoid SDK state conflicts
    return this.buildManualAuthUrl(state);
  }

  /**
   * Fallback manual OAuth URL construction
   */
  private buildManualAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state: state
    });

    return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    tenant_id: string;
    tenant_name: string;
    organisation_name: string;
  }> {
    try {
      console.log('Exchanging code for tokens...');
      
      // Manual token exchange
      console.log('Token exchange request details:', {
        clientId: this.config.clientId ? `${this.config.clientId.substring(0, 8)}...` : 'MISSING',
        clientSecret: this.config.clientSecret ? `${this.config.clientSecret.substring(0, 8)}...` : 'MISSING',
        redirectUri: this.config.redirectUri
      });

      const authHeader = `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`;
      
      const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.config.redirectUri
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      
      // Set tokens on client for tenant API calls
      this.client.setTokenSet({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type
      });
      
      // Get tenants (organisations)
      await this.client.updateTenants(false);
      const tenants = this.client.tenants;
      
      if (!tenants || tenants.length === 0) {
        throw new Error('No Xero organisations found');
      }

      // Use the first tenant (user can have multiple organisations)
      const tenant = tenants[0];
      
      console.log('✓ Token exchange successful');
      return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in || 1800,
        token_type: tokenData.token_type || 'Bearer',
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName || 'Unknown',
        organisation_name: tenant.tenantName || 'Unknown'
      };
    } catch (error) {
      console.error('Xero token exchange error:', error);
      throw new Error(`Token exchange failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    console.log('Refreshing access token...');
    
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
      console.error('Token refresh failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }

    console.log('✓ Token refresh successful');
    return response.json();
  }

  /**
   * Get Xero tenants (organizations) for the authenticated user
   */
  async getTenants(accessToken: string): Promise<Array<{
    tenantId: string;
    tenantType: string;
    tenantName: string;
    createdDateUtc: string;
  }>> {
    const response = await fetch('https://api.xero.com/connections', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get tenants: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Make authenticated API request to Xero
   */
  private async makeXeroRequest(endpoint: string, accessToken: string, tenantId: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'): Promise<any> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-Tenant-Id': tenantId,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Xero API error for ${endpoint}:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Xero API error: ${response.status} - ${response.statusText}. Response: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get organization information
   */
  async getOrganization(accessToken: string, tenantId: string): Promise<any> {
    const response = await this.makeXeroRequest('/Organisation', accessToken, tenantId);
    return response.Organisations?.[0] || null;
  }

  /**
   * Get invoices
   */
  async getInvoices(accessToken: string, tenantId: string): Promise<XeroInvoice[]> {
    const response = await this.makeXeroRequest('/Invoices', accessToken, tenantId);
    return response.Invoices || [];
  }

  /**
   * Get contacts
   */
  async getContacts(accessToken: string, tenantId: string): Promise<XeroContact[]> {
    const response = await this.makeXeroRequest('/Contacts', accessToken, tenantId);
    return response.Contacts || [];
  }

  /**
   * Get chart of accounts
   */
  async getAccounts(accessToken: string, tenantId: string): Promise<XeroAccount[]> {
    const response = await this.makeXeroRequest('/Accounts', accessToken, tenantId);
    return response.Accounts || [];
  }

  /**
   * Get bank transactions
   */
  async getBankTransactions(accessToken: string, tenantId: string): Promise<XeroBankTransaction[]> {
    const response = await this.makeXeroRequest('/BankTransactions', accessToken, tenantId);
    return response.BankTransactions || [];
  }

  /**
   * Get all data for a tenant
   */
  async getAllData(accessToken: string, tenantId: string) {
    console.log('Fetching Xero data...');
    
    try {
      console.log('Fetching organization...');
      const organization = await this.getOrganization(accessToken, tenantId);
      console.log(`✓ Organization: ${organization?.Name}`);

      console.log('Fetching invoices...');
      const invoices = await this.getInvoices(accessToken, tenantId);
      console.log(`✓ Invoices: ${invoices.length} records`);

      console.log('Fetching contacts...');
      const contacts = await this.getContacts(accessToken, tenantId);
      console.log(`✓ Contacts: ${contacts.length} records`);

      console.log('Fetching accounts...');
      const accounts = await this.getAccounts(accessToken, tenantId);
      console.log(`✓ Accounts: ${accounts.length} records`);

      console.log('Fetching bank transactions...');
      const bankTransactions = await this.getBankTransactions(accessToken, tenantId);
      console.log(`✓ Bank Transactions: ${bankTransactions.length} records`);

      return {
        organization,
        invoices,
        contacts,
        accounts,
        bank_transactions: bankTransactions,
      };
    } catch (error) {
      console.error('Error in getAllData:', error);
      throw error;
    }
  }

  /**
   * Store connection in database
   */
  async storeConnection(
    userId: string,
    tenantId: string,
    tenantName: string,
    organizationName: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ): Promise<void> {
    console.log('Storing Xero connection with params:', {
      userId: userId,
      userIdLength: userId?.length,
      tenantId: tenantId,
      organizationName: organizationName
    });

    const supabase = await this.getSupabaseClient();
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { error } = await supabase
      .from('xero_data')
      .upsert({
        user_id: userId,
        tenant_id: tenantId,
        organization_name: organizationName,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        sync_status: 'pending'
      });

    if (error) {
      console.error('Database error details:', error);
      throw new Error(`Failed to store Xero connection: ${error.message}`);
    }
  }

  /**
   * Get connection from database
   */
  async getConnection(userId: string, tenantId?: string): Promise<XeroConnection | null> {
    const supabase = await this.getSupabaseClient();
    
    let query = supabase
      .from('xero_data')
      .select('*')
      .eq('user_id', userId);
    
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    
    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw new Error(`Failed to get Xero connection: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all connections for a user
   */
  async getAllConnections(userId: string): Promise<XeroConnection[]> {
    const supabase = await this.getSupabaseClient();
    
    const { data, error } = await supabase
      .from('xero_data')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get Xero connections: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update connection tokens
   */
  async updateTokens(userId: string, tenantId: string, accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
    const supabase = await this.getSupabaseClient();
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { error } = await supabase
      .from('xero_data')
      .update({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt
      })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to update Xero tokens: ${error.message}`);
    }
  }

  /**
   * Disconnect Xero account
   */
  async disconnect(userId: string, tenantId?: string): Promise<void> {
    const supabase = await this.getSupabaseClient();
    
    let query = supabase
      .from('xero_data')
      .delete()
      .eq('user_id', userId);
    
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`Failed to disconnect Xero: ${error.message}`);
    }
  }

  /**
   * Sync data for a connection
   */
  async syncData(userId: string, tenantId: string): Promise<void> {
    const supabase = await this.getSupabaseClient();

    // Get connection
    const connection = await this.getConnection(userId, tenantId);
    if (!connection) {
      throw new Error('Xero connection not found');
    }

    // Check if token needs refresh
    const now = new Date();
    const expiresAt = new Date(connection.expires_at);
    
    let accessToken = connection.access_token;
    let refreshToken = connection.refresh_token;

    if (now >= expiresAt) {
      console.log('Access token expired, refreshing...');
      const tokens = await this.refreshAccessToken(connection.refresh_token);
      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token;
      
      await this.updateTokens(userId, tenantId, accessToken, refreshToken, tokens.expires_in);
    }

    // Update sync status to syncing
    await supabase
      .from('xero_data')
      .update({
        sync_status: 'syncing',
        last_sync_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    try {
      // Fetch all data
      const data = await this.getAllData(accessToken, tenantId);

      // Update database with synced data
      const { error } = await supabase
        .from('xero_data')
        .update({
          invoices: data.invoices,
          contacts: data.contacts,
          accounts: data.accounts,
          bank_transactions: data.bank_transactions,
          sync_status: 'completed',
          last_sync_at: new Date().toISOString(),
          error_message: null
        })
        .eq('user_id', userId)
        .eq('tenant_id', tenantId);

      if (error) {
        throw error;
      }

      console.log('✓ Xero data sync completed successfully');

    } catch (syncError) {
      // Update sync status with error
      await supabase
        .from('xero_data')
        .update({
          sync_status: 'error',
          error_message: syncError instanceof Error ? syncError.message : 'Unknown sync error'
        })
        .eq('user_id', userId)
        .eq('tenant_id', tenantId);

      throw syncError;
    }
  }
}
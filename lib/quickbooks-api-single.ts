import { createClient } from '@/utils/supabase/server';

interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sandboxBaseUrl: string;
  productionBaseUrl: string;
  discoveryDocument: string;
  scope: string;
}

interface QBToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  x_refresh_token_expires_in: number;
}

interface QBCompanyInfo {
  realmId: string;
  companyName: string;
}

export class QuickBooksAPI {
  private config: QuickBooksConfig;
  private supabase;

  constructor() {
    this.config = {
      clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || '',
      sandboxBaseUrl: 'https://sandbox-quickbooks.api.intuit.com',
      productionBaseUrl: 'https://quickbooks.api.intuit.com',
      discoveryDocument: 'https://appcenter.intuit.com/api/v1/OpenID_OIDC_ConnectDiscoveryDocument',
      scope: 'com.intuit.quickbooks.accounting'
    };
    this.supabase = createClient();
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: this.config.scope,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      access_type: 'offline',
      state: state
    });

    return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, state: string, realmId: string): Promise<QBToken & QBCompanyInfo> {
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.config.redirectUri
    });

    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json();

    // Get company info
    const companyInfo = await this.getCompanyInfo(tokenData.access_token, realmId);

    return {
      ...tokenData,
      realmId,
      companyName: companyInfo.QueryResponse?.CompanyInfo?.[0]?.CompanyName || 'Unknown Company'
    };
  }

  /**
   * Get QuickBooks connection for a user
   */
  async getConnection(userId: string) {
    const { data, error } = await this.supabase
      .from('quickbooks_data')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No connection found
      }
      throw error;
    }

    return data;
  }

  /**
   * Save QuickBooks connection
   */
  async saveConnection(userId: string, tokenData: QBToken & QBCompanyInfo): Promise<void> {
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

    const { error } = await this.supabase
      .from('quickbooks_data')
      .upsert({
        user_id: userId,
        company_id: tokenData.realmId,
        company_name: tokenData.companyName,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        status: 'active',
        qb_data: {},
        current_kpis: {}
      }, {
        onConflict: 'user_id,company_id'
      });

    if (error) {
      throw new Error(`Failed to save connection: ${error.message}`);
    }
  }

  /**
   * Update connection status
   */
  async updateConnectionStatus(userId: string, companyId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('quickbooks_data')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (error) {
      throw new Error(`Failed to update connection status: ${error.message}`);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<QBToken> {
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Make authenticated request to QuickBooks API
   */
  private async makeQBRequest(accessToken: string, companyId: string, endpoint: string): Promise<any> {
    const baseUrl = this.config.sandboxBaseUrl;
    const url = `${baseUrl}/v3/company/${companyId}/${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QB API request failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Get company information
   */
  async getCompanyInfo(accessToken: string, companyId: string): Promise<any> {
    return this.makeQBRequest(accessToken, companyId, 'companyinfo/1');
  }

  /**
   * Get all KPI-relevant data and store in JSON format
   */
  async syncKPIData(userId: string, forceFullSync: boolean = false): Promise<void> {
    const connection = await this.getConnection(userId);
    if (!connection) {
      throw new Error('No active QuickBooks connection found');
    }

    const { access_token, company_id, last_sync } = connection;
    const isIncrementalSync = !forceFullSync && last_sync;

    try {
      let syncStartTime: Date;
      
      if (isIncrementalSync) {
        syncStartTime = new Date(last_sync);
        console.log(`Starting incremental sync from ${syncStartTime.toISOString()}...`);
      } else {
        syncStartTime = new Date('2000-01-01');
        console.log('Starting full sync of all KPI data...');
      }

      // Fetch all KPI-relevant data
      console.log('Fetching QuickBooks data...');
      const [invoices, salesReceipts, payments, bills, expenses, estimates] = await Promise.all([
        this.getInvoicesUpdatedSince(access_token, company_id, syncStartTime),
        this.getSalesReceiptsUpdatedSince(access_token, company_id, syncStartTime),
        this.getPaymentsUpdatedSince(access_token, company_id, syncStartTime),
        this.getBillsUpdatedSince(access_token, company_id, syncStartTime),
        this.getExpensesUpdatedSince(access_token, company_id, syncStartTime),
        this.getEstimatesUpdatedSince(access_token, company_id, syncStartTime)
      ]);

      // Get existing data if incremental sync
      let existingData = {};
      if (isIncrementalSync && connection.qb_data) {
        existingData = connection.qb_data;
      }

      // Merge new data with existing data
      const updatedData = this.mergeQBData(existingData, {
        revenue_data: this.processRevenueData(invoices, salesReceipts, payments),
        cost_data: this.processCostData(bills, expenses),
        estimates: this.processEstimatesData(estimates)
      });

      // Update the database with new data
      const { error } = await this.supabase
        .from('quickbooks_data')
        .update({
          qb_data: updatedData,
          last_sync: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('company_id', company_id);

      if (error) {
        throw new Error(`Failed to save QB data: ${error.message}`);
      }

      const syncType = isIncrementalSync ? 'Incremental' : 'Full';
      console.log(`${syncType} KPI data sync completed successfully`);
    } catch (error) {
      console.error('Error during KPI data sync:', error);
      throw error;
    }
  }

  /**
   * Process and normalize revenue data
   */
  private processRevenueData(invoices: any[], salesReceipts: any[], payments: any[]): any[] {
    const revenueData = [];

    // Process invoices
    invoices.forEach(invoice => {
      revenueData.push({
        qb_id: invoice.Id,
        type: 'invoice',
        customer_id: invoice.CustomerRef?.value,
        customer_name: invoice.CustomerRef?.name,
        amount: parseFloat(invoice.TotalAmt || 0),
        date: invoice.TxnDate,
        due_date: invoice.DueDate,
        status: this.getInvoiceStatus(invoice),
        description: invoice.PrivateNote || invoice.CustomerMemo?.value || '',
        sync_token: invoice.SyncToken,
        qb_created_at: invoice.MetaData?.CreateTime,
        qb_updated_at: invoice.MetaData?.LastUpdatedTime
      });
    });

    // Process sales receipts
    salesReceipts.forEach(receipt => {
      revenueData.push({
        qb_id: receipt.Id,
        type: 'sales_receipt',
        customer_id: receipt.CustomerRef?.value,
        customer_name: receipt.CustomerRef?.name,
        amount: parseFloat(receipt.TotalAmt || 0),
        date: receipt.TxnDate,
        status: 'paid',
        description: receipt.PrivateNote || receipt.CustomerMemo?.value || '',
        sync_token: receipt.SyncToken,
        qb_created_at: receipt.MetaData?.CreateTime,
        qb_updated_at: receipt.MetaData?.LastUpdatedTime
      });
    });

    // Process payments
    payments.forEach(payment => {
      revenueData.push({
        qb_id: payment.Id,
        type: 'payment',
        customer_id: payment.CustomerRef?.value,
        customer_name: payment.CustomerRef?.name,
        amount: parseFloat(payment.TotalAmt || 0),
        date: payment.TxnDate,
        status: 'received',
        payment_method: payment.PaymentMethodRef?.name,
        description: payment.PrivateNote || '',
        sync_token: payment.SyncToken,
        qb_created_at: payment.MetaData?.CreateTime,
        qb_updated_at: payment.MetaData?.LastUpdatedTime
      });
    });

    return revenueData;
  }

  /**
   * Process and normalize cost data
   */
  private processCostData(bills: any[], expenses: any[]): any[] {
    const costData = [];

    // Process bills
    bills.forEach(bill => {
      costData.push({
        qb_id: bill.Id,
        type: 'bill',
        vendor_id: bill.VendorRef?.value,
        vendor_name: bill.VendorRef?.name,
        amount: parseFloat(bill.TotalAmt || 0),
        date: bill.TxnDate,
        due_date: bill.DueDate,
        category: this.categorizeCost(bill),
        description: bill.PrivateNote || bill.Memo || '',
        sync_token: bill.SyncToken,
        qb_created_at: bill.MetaData?.CreateTime,
        qb_updated_at: bill.MetaData?.LastUpdatedTime
      });
    });

    // Process expenses
    expenses.forEach(expense => {
      costData.push({
        qb_id: expense.Id,
        type: 'expense',
        vendor_id: expense.EntityRef?.value,
        vendor_name: expense.EntityRef?.name,
        amount: parseFloat(expense.TotalAmt || 0),
        date: expense.TxnDate,
        category: this.categorizeCost(expense),
        description: expense.PrivateNote || expense.Memo || '',
        sync_token: expense.SyncToken,
        qb_created_at: expense.MetaData?.CreateTime,
        qb_updated_at: expense.MetaData?.LastUpdatedTime
      });
    });

    return costData;
  }

  /**
   * Process and normalize estimates data
   */
  private processEstimatesData(estimates: any[]): any[] {
    return estimates.map(estimate => ({
      qb_id: estimate.Id,
      customer_id: estimate.CustomerRef?.value,
      customer_name: estimate.CustomerRef?.name,
      estimate_number: estimate.DocNumber,
      amount: parseFloat(estimate.TotalAmt || 0),
      date: estimate.TxnDate,
      expiry_date: estimate.ExpirationDate,
      status: this.getEstimateStatus(estimate),
      converted: false, // Will be updated when matched with invoices
      description: estimate.PrivateNote || estimate.CustomerMemo?.value || '',
      sync_token: estimate.SyncToken,
      qb_created_at: estimate.MetaData?.CreateTime,
      qb_updated_at: estimate.MetaData?.LastUpdatedTime
    }));
  }

  /**
   * Merge new data with existing data for incremental sync
   */
  private mergeQBData(existingData: any, newData: any): any {
    const merged = { ...existingData };

    // Merge each data type
    Object.keys(newData).forEach(dataType => {
      const existing = merged[dataType] || [];
      const newItems = newData[dataType] || [];

      // Create a map of existing items by qb_id for efficient lookup
      const existingMap = new Map();
      existing.forEach((item: any) => {
        existingMap.set(item.qb_id, item);
      });

      // Add or update items
      newItems.forEach((newItem: any) => {
        existingMap.set(newItem.qb_id, newItem);
      });

      // Convert back to array
      merged[dataType] = Array.from(existingMap.values());
    });

    return merged;
  }

  /**
   * Helper methods for data processing
   */
  private getInvoiceStatus(invoice: any): string {
    const balance = parseFloat(invoice.Balance || 0);
    if (balance <= 0) return 'paid';
    
    const dueDate = new Date(invoice.DueDate);
    const today = new Date();
    
    if (dueDate < today) return 'overdue';
    return 'pending';
  }

  private getEstimateStatus(estimate: any): string {
    return estimate.TxnStatus || 'pending';
  }

  private categorizeCost(transaction: any): string {
    // Simple categorization based on account or description
    const description = (transaction.PrivateNote || transaction.Memo || '').toLowerCase();
    
    if (description.includes('material') || description.includes('supply')) return 'materials';
    if (description.includes('labor') || description.includes('wage')) return 'labor';
    if (description.includes('overhead') || description.includes('rent') || description.includes('utility')) return 'overhead';
    
    return 'other';
  }

  /**
   * Incremental data fetch methods
   */
  async getInvoicesUpdatedSince(accessToken: string, companyId: string, since: Date): Promise<any[]> {
    const sinceStr = since.toISOString().split('T')[0];
    const response = await this.makeQBRequest(accessToken, companyId, `query?query=SELECT * FROM Invoice WHERE MetaData.LastUpdatedTime >= '${sinceStr}'`);
    return response?.QueryResponse?.Invoice || [];
  }

  async getSalesReceiptsUpdatedSince(accessToken: string, companyId: string, since: Date): Promise<any[]> {
    const sinceStr = since.toISOString().split('T')[0];
    const response = await this.makeQBRequest(accessToken, companyId, `query?query=SELECT * FROM SalesReceipt WHERE MetaData.LastUpdatedTime >= '${sinceStr}'`);
    return response?.QueryResponse?.SalesReceipt || [];
  }

  async getPaymentsUpdatedSince(accessToken: string, companyId: string, since: Date): Promise<any[]> {
    const sinceStr = since.toISOString().split('T')[0];
    const response = await this.makeQBRequest(accessToken, companyId, `query?query=SELECT * FROM Payment WHERE MetaData.LastUpdatedTime >= '${sinceStr}'`);
    return response?.QueryResponse?.Payment || [];
  }

  async getBillsUpdatedSince(accessToken: string, companyId: string, since: Date): Promise<any[]> {
    const sinceStr = since.toISOString().split('T')[0];
    const response = await this.makeQBRequest(accessToken, companyId, `query?query=SELECT * FROM Bill WHERE MetaData.LastUpdatedTime >= '${sinceStr}'`);
    return response?.QueryResponse?.Bill || [];
  }

  async getExpensesUpdatedSince(accessToken: string, companyId: string, since: Date): Promise<any[]> {
    const sinceStr = since.toISOString().split('T')[0];
    const response = await this.makeQBRequest(accessToken, companyId, `query?query=SELECT * FROM Purchase WHERE PaymentType='Cash' AND MetaData.LastUpdatedTime >= '${sinceStr}'`);
    return response?.QueryResponse?.Purchase || [];
  }

  async getEstimatesUpdatedSince(accessToken: string, companyId: string, since: Date): Promise<any[]> {
    const sinceStr = since.toISOString().split('T')[0];
    const response = await this.makeQBRequest(accessToken, companyId, `query?query=SELECT * FROM Estimate WHERE MetaData.LastUpdatedTime >= '${sinceStr}'`);
    return response?.QueryResponse?.Estimate || [];
  }

  /**
   * Disconnect QuickBooks integration
   */
  async disconnect(userId: string, companyId: string, preserveData: boolean = false): Promise<void> {
    if (preserveData) {
      await this.updateConnectionStatus(userId, companyId, 'disconnected');
    } else {
      const { error } = await this.supabase
        .from('quickbooks_data')
        .delete()
        .eq('user_id', userId)
        .eq('company_id', companyId);

      if (error) {
        throw new Error(`Failed to delete connection: ${error.message}`);
      }
    }
  }

  /**
   * Get QB data for a user
   */
  async getQBData(userId: string, dataType?: string): Promise<any> {
    const connection = await this.getConnection(userId);
    if (!connection) {
      return null;
    }

    if (dataType) {
      return connection.qb_data?.[dataType] || [];
    }

    return connection.qb_data || {};
  }

  /**
   * Update KPIs for a user
   */
  async updateKPIs(userId: string, kpis: any): Promise<void> {
    const { error } = await this.supabase
      .from('quickbooks_data')
      .update({ current_kpis: kpis })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to update KPIs: ${error.message}`);
    }
  }

  /**
   * Get current KPIs for a user
   */
  async getCurrentKPIs(userId: string, periodType?: string): Promise<any> {
    const connection = await this.getConnection(userId);
    if (!connection) {
      return null;
    }

    if (periodType) {
      return connection.current_kpis?.[periodType] || {};
    }

    return connection.current_kpis || {};
  }
}
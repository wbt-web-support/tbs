import { createClient } from '@/utils/supabase/server';

export interface ExternalApiData {
  id?: string;
  user_id: string;
  api_source: 'google_analytics' | 'xero' | 'servicem8' | 'quickbooks';
  account_identifier: string;
  account_name?: string;
  data_date: string; // YYYY-MM-DD format
  raw_data: any;
  metrics?: any;
  status?: 'success' | 'error' | 'partial';
  error_message?: string;
}

export interface GoogleAnalyticsData {
  // Core metrics from dashboard
  activeUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  bounceRate: number;
  averageSessionDuration: number;
  sessionsPerUser: number;
  
  // Legacy fields for backward compatibility
  totalUsers: number;
  totalSessions: number;
  totalPageviews: number;
  sessionDuration: number;
  
  // Additional data
  topPages: Array<{ page: string; pageviews: number }>;
  usersByCountry: Array<{ country: string; users: number }>;
  usersByDevice: Array<{ device: string; users: number }>;
  dailyUsers: Array<{ date: string; users: number }>;
  
  // Raw API response for debugging
  rawApiResponse?: any;
}

export interface XeroData {
  // Organization info
  organization: {
    OrganisationID: string;
    Name: string;
    LegalName: string;
    ShortCode: string;
    CountryCode: string;
    BaseCurrency: string;
    CreatedDateUTC: string;
    EndOfYearLockDate: string;
    TaxNumber: string;
    FinancialYearEndDay: number;
    FinancialYearEndMonth: number;
    SalesTaxBasis: string;
    SalesTaxPeriod: string;
    DefaultSalesTax: string;
    DefaultPurchasesTax: string;
    PeriodLockDate: string;
    Timezone: string;
    OrganisationEntityType: string;
    Class: string;
    Edition: string;
    LineOfBusiness: string;
    Addresses: any[];
    Phones: any[];
    ExternalLinks: any[];
    PaymentTerms: any;
  };
  
  // Financial data
  invoices: Array<{
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
  }>;
  
  contacts: Array<{
    ContactID: string;
    Name: string;
    EmailAddress: string;
    Addresses: any[];
    Phones: any[];
    ContactStatus: string;
    IsSupplier: boolean;
    IsCustomer: boolean;
  }>;
  
  accounts: Array<{
    AccountID: string;
    Code: string;
    Name: string;
    Type: string;
    Class: string;
    Status: string;
    BankAccountNumber?: string;
    CurrencyCode: string;
  }>;
  
  bank_transactions: Array<{
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
  }>;
  
  // Calculated KPIs
  kpis?: {
    totalRevenue: number;
    accountsReceivable: number;
    averageInvoiceValue: number;
    invoiceCount: number;
    customerCount: number;
    cashFlow: number;
    overdueAmount: number;
    daysSalesOutstanding: number;
  };
  
  // Raw API response for debugging
  rawApiResponse?: any;
}

/**
 * Save external API data to the database
 */
export async function saveExternalApiData(data: ExternalApiData): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('external_api_data')
      .upsert({
        user_id: data.user_id,
        api_source: data.api_source,
        account_identifier: data.account_identifier,
        account_name: data.account_name,
        data_date: data.data_date,
        raw_data: data.raw_data,
        metrics: data.metrics || {},
        status: data.status || 'success',
        error_message: data.error_message,
      }, {
        onConflict: 'user_id,api_source,account_identifier,data_date'
      });

    if (error) {
      console.error('Error saving external API data:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error saving external API data:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get external API data for a specific user, API source, and date range
 */
export async function getExternalApiData(
  userId: string,
  apiSource: ExternalApiData['api_source'],
  startDate?: string,
  endDate?: string,
  accountIdentifier?: string
): Promise<{ data: ExternalApiData[]; error?: string }> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from('external_api_data')
      .select('*')
      .eq('user_id', userId)
      .eq('api_source', apiSource)
      .order('data_date', { ascending: false });

    if (accountIdentifier) {
      query = query.eq('account_identifier', accountIdentifier);
    }

    if (startDate) {
      query = query.gte('data_date', startDate);
    }

    if (endDate) {
      query = query.lte('data_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching external API data:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [] };
  } catch (error) {
    console.error('Unexpected error fetching external API data:', error);
    return { 
      data: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get the latest external API data for a specific user and API source
 */
export async function getLatestExternalApiData(
  userId: string,
  apiSource: ExternalApiData['api_source'],
  accountIdentifier?: string
): Promise<{ data: ExternalApiData | null; error?: string }> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from('external_api_data')
      .select('*')
      .eq('user_id', userId)
      .eq('api_source', apiSource)
      .order('data_date', { ascending: false })
      .limit(1);

    if (accountIdentifier) {
      query = query.eq('account_identifier', accountIdentifier);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching latest external API data:', error);
      return { data: null, error: error.message };
    }

    return { data: data || null };
  } catch (error) {
    console.error('Unexpected error fetching latest external API data:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Save Google Analytics data to the database
 */
export async function saveGoogleAnalyticsData(
  userId: string,
  propertyId: string,
  accountName: string,
  analyticsData: GoogleAnalyticsData,
  dataDate: string = new Date().toISOString().split('T')[0]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract key metrics for quick access (matching your dashboard)
    const metrics = {
      // Core dashboard metrics
      activeUsers: analyticsData.activeUsers,
      newUsers: analyticsData.newUsers,
      sessions: analyticsData.sessions,
      pageViews: analyticsData.pageViews,
      bounceRate: analyticsData.bounceRate,
      averageSessionDuration: analyticsData.averageSessionDuration,
      sessionsPerUser: analyticsData.sessionsPerUser,
      
      // Legacy metrics for backward compatibility
      totalUsers: analyticsData.totalUsers,
      totalSessions: analyticsData.totalSessions,
      totalPageviews: analyticsData.totalPageviews,
      sessionDuration: analyticsData.sessionDuration,
      
      // Additional data
      deviceBreakdown: analyticsData.usersByDevice,
      topPages: analyticsData.topPages,
      usersByCountry: analyticsData.usersByCountry,
      dailyUsers: analyticsData.dailyUsers,
      
      // Summary for quick display
      summary: {
        totalActiveUsers: analyticsData.activeUsers,
        totalNewUsers: analyticsData.newUsers,
        totalSessions: analyticsData.sessions,
        totalPageViews: analyticsData.pageViews,
        averageBounceRate: analyticsData.bounceRate,
        averageSessionDuration: analyticsData.averageSessionDuration
      }
    };

    return await saveExternalApiData({
      user_id: userId,
      api_source: 'google_analytics',
      account_identifier: propertyId,
      account_name: accountName,
      data_date: dataDate,
      raw_data: analyticsData,
      metrics: metrics,
      status: 'success',
    });
  } catch (error) {
    console.error('Error saving Google Analytics data:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get Google Analytics data from the database
 */
export async function getGoogleAnalyticsData(
  userId: string,
  propertyId?: string,
  startDate?: string,
  endDate?: string
): Promise<{ data: ExternalApiData[]; error?: string }> {
  return getExternalApiData(userId, 'google_analytics', startDate, endDate, propertyId);
}

/**
 * Get the latest Google Analytics data from the database
 */
export async function getLatestGoogleAnalyticsData(
  userId: string,
  propertyId?: string
): Promise<{ data: ExternalApiData | null; error?: string }> {
  return getLatestExternalApiData(userId, 'google_analytics', propertyId);
}

/**
 * Save Xero data to the database
 */
export async function saveXeroData(
  userId: string,
  tenantId: string,
  organizationName: string,
  xeroData: XeroData,
  dataDate: string = new Date().toISOString().split('T')[0]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Calculate key metrics for quick access
    const metrics = {
      // Organization info
      organizationName: xeroData.organization?.Name || organizationName,
      organizationId: xeroData.organization?.OrganisationID,
      baseCurrency: xeroData.organization?.BaseCurrency,
      
      // Data counts
      invoiceCount: xeroData.invoices?.length || 0,
      contactCount: xeroData.contacts?.length || 0,
      accountCount: xeroData.accounts?.length || 0,
      bankTransactionCount: xeroData.bank_transactions?.length || 0,
      
      // Financial metrics
      totalRevenue: xeroData.kpis?.totalRevenue || 0,
      accountsReceivable: xeroData.kpis?.accountsReceivable || 0,
      averageInvoiceValue: xeroData.kpis?.averageInvoiceValue || 0,
      customerCount: xeroData.kpis?.customerCount || 0,
      cashFlow: xeroData.kpis?.cashFlow || 0,
      overdueAmount: xeroData.kpis?.overdueAmount || 0,
      daysSalesOutstanding: xeroData.kpis?.daysSalesOutstanding || 0,
      
      // Summary for quick display
      summary: {
        totalInvoices: xeroData.invoices?.length || 0,
        totalCustomers: xeroData.contacts?.filter(c => c.IsCustomer)?.length || 0,
        totalSuppliers: xeroData.contacts?.filter(c => c.IsSupplier)?.length || 0,
        totalRevenue: xeroData.kpis?.totalRevenue || 0,
        accountsReceivable: xeroData.kpis?.accountsReceivable || 0,
        netCashFlow: xeroData.kpis?.cashFlow || 0
      }
    };

    return await saveExternalApiData({
      user_id: userId,
      api_source: 'xero',
      account_identifier: tenantId,
      account_name: organizationName,
      data_date: dataDate,
      raw_data: xeroData,
      metrics: metrics,
      status: 'success',
    });
  } catch (error) {
    console.error('Error saving Xero data:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get Xero data from the database
 */
export async function getXeroData(
  userId: string,
  tenantId?: string,
  startDate?: string,
  endDate?: string
): Promise<{ data: ExternalApiData[]; error?: string }> {
  return getExternalApiData(userId, 'xero', startDate, endDate, tenantId);
}

/**
 * Get the latest Xero data from the database
 */
export async function getLatestXeroData(
  userId: string,
  tenantId?: string
): Promise<{ data: ExternalApiData | null; error?: string }> {
  return getLatestExternalApiData(userId, 'xero', tenantId);
}

/**
 * Clean up old external API data (for data retention)
 */
export async function cleanupOldExternalApiData(retentionDays: number = 365): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase.rpc('cleanup_old_external_api_data', {
      retention_days: retentionDays
    });

    if (error) {
      console.error('Error cleaning up old external API data:', error);
      return { success: false, error: error.message };
    }

    return { success: true, deletedCount: data };
  } catch (error) {
    console.error('Unexpected error cleaning up old external API data:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

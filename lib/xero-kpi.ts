import { XeroInvoice, XeroContact, XeroAccount, XeroBankTransaction } from './xero-api';

export interface KPI {
  value: number;
  label: string;
  unit: string;
  trend: 'up' | 'down' | 'neutral';
  change: number;
  period: string;
}

interface XeroData {
  invoices: XeroInvoice[];
  contacts: XeroContact[];
  accounts: XeroAccount[];
  bank_transactions: XeroBankTransaction[];
}

export class XeroKPI {
  private data: XeroData;
  private period: string;
  private periodStart: Date;
  private periodEnd: Date;

  constructor(data: XeroData, period: string = 'monthly') {
    this.data = data;
    this.period = period;
    this.setPeriodDates();
  }

  private setPeriodDates() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    switch (this.period) {
      case 'daily':
        this.periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        this.periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        this.periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        this.periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 7);
        break;
      case 'quarterly':
        const quarter = Math.floor(currentMonth / 3);
        this.periodStart = new Date(currentYear, quarter * 3, 1);
        this.periodEnd = new Date(currentYear, quarter * 3 + 3, 1);
        break;
      case 'yearly':
        this.periodStart = new Date(currentYear, 0, 1);
        this.periodEnd = new Date(currentYear + 1, 0, 1);
        break;
      default: // monthly
        this.periodStart = new Date(currentYear, currentMonth, 1);
        this.periodEnd = new Date(currentYear, currentMonth + 1, 1);
        break;
    }
  }

  private filterInvoicesByPeriod(invoices: XeroInvoice[]): XeroInvoice[] {
    return invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.Date);
      return invoiceDate >= this.periodStart && invoiceDate < this.periodEnd;
    });
  }

  private filterTransactionsByPeriod(transactions: XeroBankTransaction[]): XeroBankTransaction[] {
    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.Date);
      return transactionDate >= this.periodStart && transactionDate < this.periodEnd;
    });
  }

  private getPreviousPeriodData(invoices: XeroInvoice[]): XeroInvoice[] {
    const periodLength = this.periodEnd.getTime() - this.periodStart.getTime();
    const prevPeriodStart = new Date(this.periodStart.getTime() - periodLength);
    const prevPeriodEnd = new Date(this.periodEnd.getTime() - periodLength);

    return invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.Date);
      return invoiceDate >= prevPeriodStart && invoiceDate < prevPeriodEnd;
    });
  }

  private calculateTrend(current: number, previous: number): { trend: 'up' | 'down' | 'neutral'; change: number } {
    if (previous === 0) {
      return { trend: current > 0 ? 'up' : 'neutral', change: 0 };
    }

    const change = ((current - previous) / previous) * 100;
    
    if (Math.abs(change) < 1) {
      return { trend: 'neutral', change: Math.round(change * 100) / 100 };
    }
    
    return {
      trend: change > 0 ? 'up' : 'down',
      change: Math.round(change * 100) / 100
    };
  }

  /**
   * Calculate total revenue for the period
   */
  getTotalRevenue(): KPI {
    const currentInvoices = this.filterInvoicesByPeriod(this.data.invoices);
    const previousInvoices = this.getPreviousPeriodData(this.data.invoices);

    const currentRevenue = currentInvoices
      .filter(inv => inv.Status === 'PAID' || inv.Status === 'AUTHORISED')
      .reduce((sum, inv) => sum + inv.Total, 0);

    const previousRevenue = previousInvoices
      .filter(inv => inv.Status === 'PAID' || inv.Status === 'AUTHORISED')
      .reduce((sum, inv) => sum + inv.Total, 0);

    const { trend, change } = this.calculateTrend(currentRevenue, previousRevenue);

    return {
      value: Math.round(currentRevenue * 100) / 100,
      label: 'Total Revenue',
      unit: '$',
      trend,
      change,
      period: this.period
    };
  }

  /**
   * Calculate outstanding receivables (unpaid invoices)
   */
  getAccountsReceivable(): KPI {
    const unpaidInvoices = this.data.invoices.filter(inv => 
      inv.Status === 'AUTHORISED' && inv.Type === 'ACCREC'
    );

    const totalReceivable = unpaidInvoices.reduce((sum, inv) => sum + inv.Total, 0);

    // Calculate average days outstanding
    const now = new Date();
    let totalDaysOutstanding = 0;
    unpaidInvoices.forEach(inv => {
      const dueDate = new Date(inv.DueDate);
      if (dueDate < now) {
        totalDaysOutstanding += Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      }
    });

    const avgDaysOutstanding = unpaidInvoices.length > 0 ? totalDaysOutstanding / unpaidInvoices.length : 0;

    return {
      value: Math.round(totalReceivable * 100) / 100,
      label: 'Accounts Receivable',
      unit: '$',
      trend: avgDaysOutstanding > 30 ? 'down' : 'up',
      change: avgDaysOutstanding,
      period: 'current'
    };
  }

  /**
   * Calculate average invoice value
   */
  getAverageInvoiceValue(): KPI {
    const currentInvoices = this.filterInvoicesByPeriod(this.data.invoices);
    const previousInvoices = this.getPreviousPeriodData(this.data.invoices);

    const paidCurrentInvoices = currentInvoices.filter(inv => inv.Status === 'PAID');
    const paidPreviousInvoices = previousInvoices.filter(inv => inv.Status === 'PAID');

    const currentAvg = paidCurrentInvoices.length > 0 
      ? paidCurrentInvoices.reduce((sum, inv) => sum + inv.Total, 0) / paidCurrentInvoices.length
      : 0;

    const previousAvg = paidPreviousInvoices.length > 0 
      ? paidPreviousInvoices.reduce((sum, inv) => sum + inv.Total, 0) / paidPreviousInvoices.length
      : 0;

    const { trend, change } = this.calculateTrend(currentAvg, previousAvg);

    return {
      value: Math.round(currentAvg * 100) / 100,
      label: 'Average Invoice Value',
      unit: '$',
      trend,
      change,
      period: this.period
    };
  }

  /**
   * Calculate invoice count
   */
  getInvoiceCount(): KPI {
    const currentInvoices = this.filterInvoicesByPeriod(this.data.invoices);
    const previousInvoices = this.getPreviousPeriodData(this.data.invoices);

    const currentCount = currentInvoices.length;
    const previousCount = previousInvoices.length;

    const { trend, change } = this.calculateTrend(currentCount, previousCount);

    return {
      value: currentCount,
      label: 'Total Invoices',
      unit: '',
      trend,
      change,
      period: this.period
    };
  }

  /**
   * Calculate customer count
   */
  getCustomerCount(): KPI {
    const customers = this.data.contacts.filter(contact => contact.IsCustomer);
    
    // This is a current snapshot, so no trend calculation
    return {
      value: customers.length,
      label: 'Total Customers',
      unit: '',
      trend: 'neutral',
      change: 0,
      period: 'current'
    };
  }

  /**
   * Calculate cash flow (bank transactions)
   */
  getCashFlow(): KPI {
    const currentTransactions = this.filterTransactionsByPeriod(this.data.bank_transactions);
    
    const inflows = currentTransactions
      .filter(txn => txn.Type === 'RECEIVE' && txn.Status === 'AUTHORISED')
      .reduce((sum, txn) => sum + txn.Total, 0);

    const outflows = currentTransactions
      .filter(txn => txn.Type === 'SPEND' && txn.Status === 'AUTHORISED')
      .reduce((sum, txn) => sum + txn.Total, 0);

    const netCashFlow = inflows - outflows;

    return {
      value: Math.round(netCashFlow * 100) / 100,
      label: 'Net Cash Flow',
      unit: '$',
      trend: netCashFlow >= 0 ? 'up' : 'down',
      change: 0, // Would need previous period data for proper trend
      period: this.period
    };
  }

  /**
   * Calculate overdue invoices
   */
  getOverdueInvoices(): KPI {
    const now = new Date();
    const overdueInvoices = this.data.invoices.filter(inv => {
      const dueDate = new Date(inv.DueDate);
      return inv.Status === 'AUTHORISED' && dueDate < now && inv.Type === 'ACCREC';
    });

    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.Total, 0);

    return {
      value: Math.round(overdueAmount * 100) / 100,
      label: 'Overdue Amount',
      unit: '$',
      trend: overdueAmount > 0 ? 'down' : 'up',
      change: overdueInvoices.length,
      period: 'current'
    };
  }

  /**
   * Calculate days sales outstanding (DSO)
   */
  getDaysSalesOutstanding(): KPI {
    const receivables = this.getAccountsReceivable();
    const revenue = this.getTotalRevenue();
    
    // Calculate daily sales (monthly revenue / 30 days, adjust for period)
    let daysInPeriod = 30;
    switch (this.period) {
      case 'daily': daysInPeriod = 1; break;
      case 'weekly': daysInPeriod = 7; break;
      case 'quarterly': daysInPeriod = 90; break;
      case 'yearly': daysInPeriod = 365; break;
    }

    const dailySales = revenue.value / daysInPeriod;
    const dso = dailySales > 0 ? receivables.value / dailySales : 0;

    return {
      value: Math.round(dso * 10) / 10,
      label: 'Days Sales Outstanding',
      unit: ' days',
      trend: dso > 30 ? 'down' : 'up',
      change: 0,
      period: this.period
    };
  }

  /**
   * Get all KPIs
   */
  getAllKPIs(): KPI[] {
    try {
      return [
        this.getTotalRevenue(),
        this.getAccountsReceivable(),
        this.getAverageInvoiceValue(),
        this.getInvoiceCount(),
        this.getCustomerCount(),
        this.getCashFlow(),
        this.getOverdueInvoices(),
        this.getDaysSalesOutstanding(),
      ];
    } catch (error) {
      console.error('Error calculating Xero KPIs:', error);
      // Return empty KPIs array if calculation fails
      return [];
    }
  }
}
import { createClient } from '@/utils/supabase/server';

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type KPIType = 'revenue' | 'gross_profit' | 'job_completion_rate' | 'quote_conversion_rate' | 'average_job_value' | 'customer_satisfaction';

interface KPIResult {
  kpi_type: KPIType;
  period_type: PeriodType;
  period_start: Date;
  period_end: Date;
  current_value: number;
  previous_value: number;
  change_percentage: number;
  data_points: number;
  calculated_at: Date;
}

export class QuickBooksKPICalculator {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Get QB data for a user
   */
  private async getQBData(userId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('quickbooks_data')
      .select('qb_data')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error) {
      console.error('Error fetching QB data:', error);
      return null;
    }

    return data?.qb_data || {};
  }

  /**
   * Calculate date ranges for current and previous periods
   */
  private calculatePeriodRanges(periodType: PeriodType, customStart?: Date, customEnd?: Date): {
    currentStart: Date;
    currentEnd: Date;
    previousStart: Date;
    previousEnd: Date;
  } {
    let currentStart: Date;
    let currentEnd: Date;

    if (customStart && customEnd) {
      currentStart = new Date(customStart);
      currentEnd = new Date(customEnd);
    } else {
      const now = new Date();
      
      switch (periodType) {
        case 'daily':
          currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
        case 'weekly':
          const dayOfWeek = now.getDay();
          currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
          currentEnd = new Date(currentStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
          currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
        case 'quarterly':
          const quarter = Math.floor(now.getMonth() / 3);
          currentStart = new Date(now.getFullYear(), quarter * 3, 1);
          currentEnd = new Date(now.getFullYear(), quarter * 3 + 3, 1);
          break;
        case 'yearly':
          currentStart = new Date(now.getFullYear(), 0, 1);
          currentEnd = new Date(now.getFullYear() + 1, 0, 1);
          break;
        default:
          throw new Error(`Invalid period type: ${periodType}`);
      }
    }

    // Calculate previous period
    const periodLength = currentEnd.getTime() - currentStart.getTime();
    const previousEnd = new Date(currentStart.getTime());
    const previousStart = new Date(currentStart.getTime() - periodLength);

    return { currentStart, currentEnd, previousStart, previousEnd };
  }

  /**
   * Filter data by date range
   */
  private filterByDateRange(data: any[], startDate: Date, endDate: Date, dateField: string = 'date'): any[] {
    if (!Array.isArray(data)) return [];
    
    return data.filter(item => {
      const itemDate = new Date(item[dateField]);
      return itemDate >= startDate && itemDate < endDate;
    });
  }

  /**
   * Calculate Revenue KPI
   */
  async calculateRevenue(userId: string, periodType: PeriodType, customStart?: Date, customEnd?: Date): Promise<KPIResult> {
    const qbData = await this.getQBData(userId);
    const revenueData = qbData.revenue_data || [];
    
    const { currentStart, currentEnd, previousStart, previousEnd } = this.calculatePeriodRanges(periodType, customStart, customEnd);

    // Calculate current period revenue
    const currentRevenueData = this.filterByDateRange(revenueData, currentStart, currentEnd);
    const currentValue = currentRevenueData
      .filter(item => item.type !== 'payment') // Avoid double counting
      .reduce((sum, item) => sum + (item.amount || 0), 0);

    // Calculate previous period revenue
    const previousRevenueData = this.filterByDateRange(revenueData, previousStart, previousEnd);
    const previousValue = previousRevenueData
      .filter(item => item.type !== 'payment')
      .reduce((sum, item) => sum + (item.amount || 0), 0);

    // Calculate change percentage
    const changePercentage = previousValue > 0 
      ? ((currentValue - previousValue) / previousValue) * 100 
      : currentValue > 0 ? 100 : 0;

    return {
      kpi_type: 'revenue',
      period_type: periodType,
      period_start: currentStart,
      period_end: currentEnd,
      current_value: currentValue,
      previous_value: previousValue,
      change_percentage: changePercentage,
      data_points: currentRevenueData.length,
      calculated_at: new Date()
    };
  }

  /**
   * Calculate Gross Profit KPI
   */
  async calculateGrossProfit(userId: string, periodType: PeriodType, customStart?: Date, customEnd?: Date): Promise<KPIResult> {
    const qbData = await this.getQBData(userId);
    const revenueData = qbData.revenue_data || [];
    const costData = qbData.cost_data || [];
    
    const { currentStart, currentEnd, previousStart, previousEnd } = this.calculatePeriodRanges(periodType, customStart, customEnd);

    // Calculate current period
    const currentRevenueData = this.filterByDateRange(revenueData, currentStart, currentEnd);
    const currentCostData = this.filterByDateRange(costData, currentStart, currentEnd);
    
    const currentRevenue = currentRevenueData
      .filter(item => item.type !== 'payment')
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    
    const currentCosts = currentCostData
      .filter(item => item.category === 'materials' || item.category === 'labor')
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    
    const currentValue = currentRevenue - currentCosts;

    // Calculate previous period
    const previousRevenueData = this.filterByDateRange(revenueData, previousStart, previousEnd);
    const previousCostData = this.filterByDateRange(costData, previousStart, previousEnd);
    
    const previousRevenue = previousRevenueData
      .filter(item => item.type !== 'payment')
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    
    const previousCosts = previousCostData
      .filter(item => item.category === 'materials' || item.category === 'labor')
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    
    const previousValue = previousRevenue - previousCosts;

    const changePercentage = previousValue > 0 
      ? ((currentValue - previousValue) / previousValue) * 100 
      : currentValue > 0 ? 100 : 0;

    return {
      kpi_type: 'gross_profit',
      period_type: periodType,
      period_start: currentStart,
      period_end: currentEnd,
      current_value: currentValue,
      previous_value: previousValue,
      change_percentage: changePercentage,
      data_points: currentRevenueData.length + currentCostData.length,
      calculated_at: new Date()
    };
  }

  /**
   * Calculate Job Completion Rate KPI
   */
  async calculateJobCompletionRate(userId: string, periodType: PeriodType, customStart?: Date, customEnd?: Date): Promise<KPIResult> {
    const qbData = await this.getQBData(userId);
    const revenueData = qbData.revenue_data || [];
    
    const { currentStart, currentEnd, previousStart, previousEnd } = this.calculatePeriodRanges(periodType, customStart, customEnd);

    // Current period
    const currentJobs = this.filterByDateRange(revenueData, currentStart, currentEnd)
      .filter(item => item.type === 'invoice');
    
    const currentCompletedJobs = currentJobs.filter(item => item.status === 'paid');
    const currentValue = currentJobs.length > 0 ? (currentCompletedJobs.length / currentJobs.length) * 100 : 0;

    // Previous period
    const previousJobs = this.filterByDateRange(revenueData, previousStart, previousEnd)
      .filter(item => item.type === 'invoice');
    
    const previousCompletedJobs = previousJobs.filter(item => item.status === 'paid');
    const previousValue = previousJobs.length > 0 ? (previousCompletedJobs.length / previousJobs.length) * 100 : 0;

    const changePercentage = previousValue > 0 
      ? ((currentValue - previousValue) / previousValue) * 100 
      : currentValue > 0 ? 100 : 0;

    return {
      kpi_type: 'job_completion_rate',
      period_type: periodType,
      period_start: currentStart,
      period_end: currentEnd,
      current_value: currentValue,
      previous_value: previousValue,
      change_percentage: changePercentage,
      data_points: currentJobs.length,
      calculated_at: new Date()
    };
  }

  /**
   * Calculate Quote Conversion Rate KPI
   */
  async calculateQuoteConversionRate(userId: string, periodType: PeriodType, customStart?: Date, customEnd?: Date): Promise<KPIResult> {
    const qbData = await this.getQBData(userId);
    const estimates = qbData.estimates || [];
    const revenueData = qbData.revenue_data || [];
    
    const { currentStart, currentEnd, previousStart, previousEnd } = this.calculatePeriodRanges(periodType, customStart, customEnd);

    // Match estimates to invoices for conversion tracking
    const matchEstimatesToInvoices = (estimatesData: any[], revenueData: any[]) => {
      const invoices = revenueData.filter(item => item.type === 'invoice');
      
      return estimatesData.map(estimate => {
        const matchingInvoice = invoices.find(invoice => 
          invoice.customer_id === estimate.customer_id &&
          Math.abs(invoice.amount - estimate.amount) < 10 && // Small tolerance for amount differences
          new Date(invoice.date) >= new Date(estimate.date)
        );
        
        return {
          ...estimate,
          converted: !!matchingInvoice,
          converted_invoice_id: matchingInvoice?.qb_id
        };
      });
    };

    // Current period
    const currentEstimates = this.filterByDateRange(estimates, currentStart, currentEnd);
    const currentWithConversions = matchEstimatesToInvoices(currentEstimates, revenueData);
    const currentConverted = currentWithConversions.filter(est => est.converted);
    const currentValue = currentEstimates.length > 0 ? (currentConverted.length / currentEstimates.length) * 100 : 0;

    // Previous period
    const previousEstimates = this.filterByDateRange(estimates, previousStart, previousEnd);
    const previousWithConversions = matchEstimatesToInvoices(previousEstimates, revenueData);
    const previousConverted = previousWithConversions.filter(est => est.converted);
    const previousValue = previousEstimates.length > 0 ? (previousConverted.length / previousEstimates.length) * 100 : 0;

    const changePercentage = previousValue > 0 
      ? ((currentValue - previousValue) / previousValue) * 100 
      : currentValue > 0 ? 100 : 0;

    return {
      kpi_type: 'quote_conversion_rate',
      period_type: periodType,
      period_start: currentStart,
      period_end: currentEnd,
      current_value: currentValue,
      previous_value: previousValue,
      change_percentage: changePercentage,
      data_points: currentEstimates.length,
      calculated_at: new Date()
    };
  }

  /**
   * Calculate Average Job Value KPI
   */
  async calculateAverageJobValue(userId: string, periodType: PeriodType, customStart?: Date, customEnd?: Date): Promise<KPIResult> {
    const qbData = await this.getQBData(userId);
    const revenueData = qbData.revenue_data || [];
    
    const { currentStart, currentEnd, previousStart, previousEnd } = this.calculatePeriodRanges(periodType, customStart, customEnd);

    // Current period
    const currentJobs = this.filterByDateRange(revenueData, currentStart, currentEnd)
      .filter(item => item.type === 'invoice');
    
    const currentValue = currentJobs.length > 0 
      ? currentJobs.reduce((sum, job) => sum + (job.amount || 0), 0) / currentJobs.length 
      : 0;

    // Previous period
    const previousJobs = this.filterByDateRange(revenueData, previousStart, previousEnd)
      .filter(item => item.type === 'invoice');
    
    const previousValue = previousJobs.length > 0 
      ? previousJobs.reduce((sum, job) => sum + (job.amount || 0), 0) / previousJobs.length 
      : 0;

    const changePercentage = previousValue > 0 
      ? ((currentValue - previousValue) / previousValue) * 100 
      : currentValue > 0 ? 100 : 0;

    return {
      kpi_type: 'average_job_value',
      period_type: periodType,
      period_start: currentStart,
      period_end: currentEnd,
      current_value: currentValue,
      previous_value: previousValue,
      change_percentage: changePercentage,
      data_points: currentJobs.length,
      calculated_at: new Date()
    };
  }

  /**
   * Calculate Customer Satisfaction KPI (based on payment timing)
   */
  async calculateCustomerSatisfaction(userId: string, periodType: PeriodType, customStart?: Date, customEnd?: Date): Promise<KPIResult> {
    const qbData = await this.getQBData(userId);
    const revenueData = qbData.revenue_data || [];
    
    const { currentStart, currentEnd, previousStart, previousEnd } = this.calculatePeriodRanges(periodType, customStart, customEnd);

    // Calculate satisfaction based on payment behavior
    const calculateSatisfaction = (invoices: any[]) => {
      if (invoices.length === 0) return 0;
      
      const paidOnTime = invoices.filter(invoice => {
        if (invoice.status !== 'paid' || !invoice.due_date || !invoice.payment_date) return false;
        
        const dueDate = new Date(invoice.due_date);
        const paymentDate = new Date(invoice.payment_date);
        return paymentDate <= dueDate;
      });
      
      const paidEarly = invoices.filter(invoice => {
        if (invoice.status !== 'paid' || !invoice.due_date || !invoice.payment_date) return false;
        
        const dueDate = new Date(invoice.due_date);
        const paymentDate = new Date(invoice.payment_date);
        const daysDiff = (dueDate.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff > 7; // Paid more than a week early
      });
      
      // Weight early payments more heavily
      return ((paidOnTime.length + (paidEarly.length * 1.5)) / invoices.length) * 100;
    };

    // Current period
    const currentInvoices = this.filterByDateRange(revenueData, currentStart, currentEnd)
      .filter(item => item.type === 'invoice');
    const currentValue = calculateSatisfaction(currentInvoices);

    // Previous period
    const previousInvoices = this.filterByDateRange(revenueData, previousStart, previousEnd)
      .filter(item => item.type === 'invoice');
    const previousValue = calculateSatisfaction(previousInvoices);

    const changePercentage = previousValue > 0 
      ? ((currentValue - previousValue) / previousValue) * 100 
      : currentValue > 0 ? 100 : 0;

    return {
      kpi_type: 'customer_satisfaction',
      period_type: periodType,
      period_start: currentStart,
      period_end: currentEnd,
      current_value: currentValue,
      previous_value: previousValue,
      change_percentage: changePercentage,
      data_points: currentInvoices.length,
      calculated_at: new Date()
    };
  }

  /**
   * Calculate all KPIs for a user
   */
  async getAllKPIs(userId: string, periodType: PeriodType, customStart?: Date, customEnd?: Date): Promise<KPIResult[]> {
    const results = await Promise.all([
      this.calculateRevenue(userId, periodType, customStart, customEnd),
      this.calculateGrossProfit(userId, periodType, customStart, customEnd),
      this.calculateJobCompletionRate(userId, periodType, customStart, customEnd),
      this.calculateQuoteConversionRate(userId, periodType, customStart, customEnd),
      this.calculateAverageJobValue(userId, periodType, customStart, customEnd),
      this.calculateCustomerSatisfaction(userId, periodType, customStart, customEnd)
    ]);

    // Save KPI snapshots to the database
    await this.saveAllKPIs(userId, results);

    return results;
  }

  /**
   * Save all calculated KPIs to the database
   */
  private async saveAllKPIs(userId: string, kpis: KPIResult[]): Promise<void> {
    // Organize KPIs by period type
    const kpisByPeriod: { [key: string]: any } = {};
    
    kpis.forEach(kpi => {
      if (!kpisByPeriod[kpi.period_type]) {
        kpisByPeriod[kpi.period_type] = {};
      }
      
      kpisByPeriod[kpi.period_type][kpi.kpi_type] = {
        value: kpi.current_value,
        change: kpi.change_percentage,
        calculated_at: kpi.calculated_at.toISOString(),
        data_points: kpi.data_points
      };
    });

    // Update the database with the new KPIs
    const { error } = await this.supabase
      .from('quickbooks_data')
      .update({ current_kpis: kpisByPeriod })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to save KPIs: ${error.message}`);
    }
  }
}
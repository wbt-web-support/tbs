import { QuickBooksAPISimplified } from './quickbooks-api-simplified';

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type KPIType = 'revenue' | 'gross_profit' | 'job_completion_rate' | 'quote_conversion_rate' | 'average_job_value' | 'customer_satisfaction';

export interface KPIResult {
  kpi_type: KPIType;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  current_value: number;
  previous_value: number;
  change_percentage: number;
  calculated_at: string;
  data_points: number;
  metadata?: any;
}

export class QuickBooksKPICalculatorSimplified {
  private qbAPI: QuickBooksAPISimplified;

  constructor() {
    this.qbAPI = new QuickBooksAPISimplified();
  }

  /**
   * Calculate all KPIs for a user
   */
  async getAllKPIs(
    userId: string,
    periodType: PeriodType = 'monthly',
    customStart?: Date,
    customEnd?: Date
  ): Promise<KPIResult[]> {
    const results: KPIResult[] = [];

    // Get the data from JSON storage
    const data = await this.qbAPI.getStoredData(userId);
    
    if (!data || (!data.revenue_data?.length && !data.cost_data?.length && !data.estimates?.length)) {
      console.log('No data available for KPI calculation');
      return results;
    }

    const { startDate, endDate } = this.getPeriodRange(periodType, customStart, customEnd);
    const { startDate: prevStartDate, endDate: prevEndDate } = this.getPreviousPeriodRange(periodType, startDate, endDate);

    // Calculate each KPI
    const kpis: KPIType[] = [
      'revenue',
      'gross_profit', 
      'job_completion_rate',
      'quote_conversion_rate',
      'average_job_value',
      'customer_satisfaction'
    ];

    for (const kpiType of kpis) {
      try {
        const result = await this.calculateKPI(
          kpiType,
          data,
          periodType,
          startDate,
          endDate,
          prevStartDate,
          prevEndDate
        );
        results.push(result);
      } catch (error) {
        console.error(`Error calculating ${kpiType}:`, error);
      }
    }

    // Store the calculated KPIs
    const kpisForStorage = results.reduce((acc, kpi) => {
      acc[kpi.kpi_type] = {
        value: kpi.current_value,
        change: kpi.change_percentage,
        lastCalculated: kpi.calculated_at
      };
      return acc;
    }, {} as any);

    await this.qbAPI.storeKPIs(userId, periodType, kpisForStorage);

    return results;
  }

  /**
   * Calculate a specific KPI
   */
  private async calculateKPI(
    kpiType: KPIType,
    data: any,
    periodType: PeriodType,
    startDate: Date,
    endDate: Date,
    prevStartDate: Date,
    prevEndDate: Date
  ): Promise<KPIResult> {
    let currentValue = 0;
    let previousValue = 0;
    let dataPoints = 0;
    let metadata = {};

    switch (kpiType) {
      case 'revenue':
        const revenueResult = this.calculateRevenue(data, startDate, endDate, prevStartDate, prevEndDate);
        currentValue = revenueResult.current;
        previousValue = revenueResult.previous;
        dataPoints = revenueResult.dataPoints;
        metadata = revenueResult.metadata;
        break;

      case 'gross_profit':
        const profitResult = this.calculateGrossProfit(data, startDate, endDate, prevStartDate, prevEndDate);
        currentValue = profitResult.current;
        previousValue = profitResult.previous;
        dataPoints = profitResult.dataPoints;
        metadata = profitResult.metadata;
        break;

      case 'job_completion_rate':
        const completionResult = this.calculateJobCompletionRate(data, startDate, endDate, prevStartDate, prevEndDate);
        currentValue = completionResult.current;
        previousValue = completionResult.previous;
        dataPoints = completionResult.dataPoints;
        break;

      case 'quote_conversion_rate':
        const conversionResult = this.calculateQuoteConversionRate(data, startDate, endDate, prevStartDate, prevEndDate);
        currentValue = conversionResult.current;
        previousValue = conversionResult.previous;
        dataPoints = conversionResult.dataPoints;
        break;

      case 'average_job_value':
        const avgValueResult = this.calculateAverageJobValue(data, startDate, endDate, prevStartDate, prevEndDate);
        currentValue = avgValueResult.current;
        previousValue = avgValueResult.previous;
        dataPoints = avgValueResult.dataPoints;
        break;

      case 'customer_satisfaction':
        const satisfactionResult = this.calculateCustomerSatisfaction(data, startDate, endDate, prevStartDate, prevEndDate);
        currentValue = satisfactionResult.current;
        previousValue = satisfactionResult.previous;
        dataPoints = satisfactionResult.dataPoints;
        break;
    }

    const changePercentage = previousValue > 0 
      ? ((currentValue - previousValue) / previousValue) * 100 
      : currentValue > 0 ? 100 : 0;

    return {
      kpi_type: kpiType,
      period_type: periodType,
      period_start: startDate.toISOString().split('T')[0],
      period_end: endDate.toISOString().split('T')[0],
      current_value: currentValue,
      previous_value: previousValue,
      change_percentage: changePercentage,
      calculated_at: new Date().toISOString(),
      data_points: dataPoints,
      metadata
    };
  }

  /**
   * Calculate revenue from JSON data
   */
  private calculateRevenue(data: any, startDate: Date, endDate: Date, prevStartDate: Date, prevEndDate: Date) {
    const revenueData = data.revenue_data || [];
    
    const currentRevenue = revenueData
      .filter((item: any) => {
        const itemDate = new Date(item.date);
        return itemDate >= startDate && itemDate <= endDate && item.type !== 'payment';
      })
      .reduce((sum: number, item: any) => sum + (item.amount || 0), 0);

    const previousRevenue = revenueData
      .filter((item: any) => {
        const itemDate = new Date(item.date);
        return itemDate >= prevStartDate && itemDate <= prevEndDate && item.type !== 'payment';
      })
      .reduce((sum: number, item: any) => sum + (item.amount || 0), 0);

    const dataPoints = revenueData.filter((item: any) => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate && item.type !== 'payment';
    }).length;

    return {
      current: currentRevenue,
      previous: previousRevenue,
      dataPoints,
      metadata: {
        breakdown: {
          invoices: revenueData.filter((item: any) => item.type === 'invoice' && new Date(item.date) >= startDate && new Date(item.date) <= endDate).length,
          salesReceipts: revenueData.filter((item: any) => item.type === 'sales_receipt' && new Date(item.date) >= startDate && new Date(item.date) <= endDate).length
        }
      }
    };
  }

  /**
   * Calculate gross profit from JSON data
   */
  private calculateGrossProfit(data: any, startDate: Date, endDate: Date, prevStartDate: Date, prevEndDate: Date) {
    const revenueResult = this.calculateRevenue(data, startDate, endDate, prevStartDate, prevEndDate);
    const costData = data.cost_data || [];

    const currentCosts = costData
      .filter((item: any) => {
        const itemDate = new Date(item.date);
        return itemDate >= startDate && itemDate <= endDate;
      })
      .reduce((sum: number, item: any) => sum + (item.amount || 0), 0);

    const previousCosts = costData
      .filter((item: any) => {
        const itemDate = new Date(item.date);
        return itemDate >= prevStartDate && itemDate <= prevEndDate;
      })
      .reduce((sum: number, item: any) => sum + (item.amount || 0), 0);

    const costDataPoints = costData.filter((item: any) => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate;
    }).length;

    return {
      current: revenueResult.current - currentCosts,
      previous: revenueResult.previous - previousCosts,
      dataPoints: revenueResult.dataPoints + costDataPoints,
      metadata: {
        revenue: revenueResult.current,
        costs: currentCosts,
        margin: revenueResult.current > 0 ? ((revenueResult.current - currentCosts) / revenueResult.current) * 100 : 0
      }
    };
  }

  /**
   * Calculate job completion rate from JSON data
   */
  private calculateJobCompletionRate(data: any, startDate: Date, endDate: Date, prevStartDate: Date, prevEndDate: Date) {
    const revenueData = data.revenue_data || [];
    
    const currentJobs = revenueData.filter((item: any) => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate && item.type === 'invoice' && item.job_name;
    });

    const currentCompletedJobs = currentJobs.filter((item: any) => item.status === 'paid');
    const currentRate = currentJobs.length > 0 ? (currentCompletedJobs.length / currentJobs.length) * 100 : 0;

    const previousJobs = revenueData.filter((item: any) => {
      const itemDate = new Date(item.date);
      return itemDate >= prevStartDate && itemDate <= prevEndDate && item.type === 'invoice' && item.job_name;
    });

    const previousCompletedJobs = previousJobs.filter((item: any) => item.status === 'paid');
    const previousRate = previousJobs.length > 0 ? (previousCompletedJobs.length / previousJobs.length) * 100 : 0;

    return {
      current: currentRate,
      previous: previousRate,
      dataPoints: currentJobs.length
    };
  }

  /**
   * Calculate quote conversion rate from JSON data
   */
  private calculateQuoteConversionRate(data: any, startDate: Date, endDate: Date, prevStartDate: Date, prevEndDate: Date) {
    const estimates = data.estimates || [];
    const revenueData = data.revenue_data || [];

    const currentEstimates = estimates.filter((item: any) => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate;
    });

    // Check for converted estimates by matching customer and similar amounts
    const currentConvertedEstimates = currentEstimates.filter((estimate: any) => {
      return revenueData.some((revenue: any) => 
        revenue.customer_id === estimate.customer_id &&
        Math.abs(revenue.amount - estimate.amount) < (estimate.amount * 0.1) && // 10% tolerance
        new Date(revenue.date) >= new Date(estimate.date)
      );
    });

    const currentRate = currentEstimates.length > 0 ? (currentConvertedEstimates.length / currentEstimates.length) * 100 : 0;

    const previousEstimates = estimates.filter((item: any) => {
      const itemDate = new Date(item.date);
      return itemDate >= prevStartDate && itemDate <= prevEndDate;
    });

    const previousConvertedEstimates = previousEstimates.filter((estimate: any) => {
      return revenueData.some((revenue: any) => 
        revenue.customer_id === estimate.customer_id &&
        Math.abs(revenue.amount - estimate.amount) < (estimate.amount * 0.1) &&
        new Date(revenue.date) >= new Date(estimate.date)
      );
    });

    const previousRate = previousEstimates.length > 0 ? (previousConvertedEstimates.length / previousEstimates.length) * 100 : 0;

    return {
      current: currentRate,
      previous: previousRate,
      dataPoints: currentEstimates.length
    };
  }

  /**
   * Calculate average job value from JSON data
   */
  private calculateAverageJobValue(data: any, startDate: Date, endDate: Date, prevStartDate: Date, prevEndDate: Date) {
    const revenueData = data.revenue_data || [];
    
    const currentJobs = revenueData.filter((item: any) => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate && item.type === 'invoice';
    });

    const currentTotal = currentJobs.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const currentAverage = currentJobs.length > 0 ? currentTotal / currentJobs.length : 0;

    const previousJobs = revenueData.filter((item: any) => {
      const itemDate = new Date(item.date);
      return itemDate >= prevStartDate && itemDate <= prevEndDate && item.type === 'invoice';
    });

    const previousTotal = previousJobs.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const previousAverage = previousJobs.length > 0 ? previousTotal / previousJobs.length : 0;

    return {
      current: currentAverage,
      previous: previousAverage,
      dataPoints: currentJobs.length
    };
  }

  /**
   * Calculate customer satisfaction from JSON data
   */
  private calculateCustomerSatisfaction(data: any, startDate: Date, endDate: Date, prevStartDate: Date, prevEndDate: Date) {
    const revenueData = data.revenue_data || [];
    
    // Calculate satisfaction based on payment timeliness
    const currentInvoices = revenueData.filter((item: any) => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate && item.type === 'invoice' && item.due_date;
    });

    const currentOnTimePayments = currentInvoices.filter((item: any) => {
      if (item.status !== 'paid') return false;
      const dueDate = new Date(item.due_date);
      const paymentDate = new Date(item.payment_date || item.date);
      return paymentDate <= dueDate;
    });

    const currentRate = currentInvoices.length > 0 ? (currentOnTimePayments.length / currentInvoices.length) * 100 : 0;

    const previousInvoices = revenueData.filter((item: any) => {
      const itemDate = new Date(item.date);
      return itemDate >= prevStartDate && itemDate <= prevEndDate && item.type === 'invoice' && item.due_date;
    });

    const previousOnTimePayments = previousInvoices.filter((item: any) => {
      if (item.status !== 'paid') return false;
      const dueDate = new Date(item.due_date);
      const paymentDate = new Date(item.payment_date || item.date);
      return paymentDate <= dueDate;
    });

    const previousRate = previousInvoices.length > 0 ? (previousOnTimePayments.length / previousInvoices.length) * 100 : 0;

    return {
      current: currentRate,
      previous: previousRate,
      dataPoints: currentInvoices.length
    };
  }

  /**
   * Get period date range
   */
  private getPeriodRange(periodType: PeriodType, customStart?: Date, customEnd?: Date): { startDate: Date; endDate: Date } {
    if (customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }

    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate: Date;

    switch (periodType) {
      case 'daily':
        startDate = new Date(endDate);
        break;
      case 'weekly':
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 6);
        break;
      case 'monthly':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        break;
      case 'quarterly':
        const quarterStart = Math.floor(endDate.getMonth() / 3) * 3;
        startDate = new Date(endDate.getFullYear(), quarterStart, 1);
        break;
      case 'yearly':
        startDate = new Date(endDate.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    }

    return { startDate, endDate };
  }

  /**
   * Get previous period date range for comparison
   */
  private getPreviousPeriodRange(periodType: PeriodType, currentStart: Date, currentEnd: Date): { startDate: Date; endDate: Date } {
    const periodLength = currentEnd.getTime() - currentStart.getTime();
    const endDate = new Date(currentStart.getTime() - 1);
    const startDate = new Date(endDate.getTime() - periodLength);

    return { startDate, endDate };
  }
}
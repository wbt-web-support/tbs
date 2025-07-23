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

interface ServiceM8JobActivity {
  uuid: string;
  job_uuid: string;
  staff_uuid: string;
  start_time: string;
  end_time?: string;
  description: string;
}

interface ServiceM8Company {
  uuid: string;
  name: string;
  email: string;
  phone: string;
}

interface KPIResult {
  value: number;
  label: string;
  unit: string;
  trend: 'up' | 'down' | 'neutral';
  change: number;
  period: string;
}

interface ServiceM8Data {
  jobs: ServiceM8Job[];
  staff: ServiceM8Staff[];
  job_activities: ServiceM8JobActivity[];
  companies: ServiceM8Company[];
}

export class ServiceM8KPI {
  private data: ServiceM8Data;
  private period: string;

  constructor(data: ServiceM8Data, period: string = 'monthly') {
    this.data = data;
    this.period = period;
  }

  private getDateRange() {
    const now = new Date();
    let startDate: Date;

    switch (this.period) {
      case 'daily':
        startDate = new Date(now.setDate(now.getDate() - 1));
        break;
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'monthly':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'quarterly':
        startDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    return startDate;
  }

  private filterJobsByPeriod(jobs: ServiceM8Job[]) {
    const startDate = this.getDateRange();
    return jobs.filter(job => {
      const jobDate = new Date(job.job_date);
      return jobDate >= startDate;
    });
  }

  // 1. Job Completion Rate
  calculateJobCompletionRate(): KPIResult {
    const periodJobs = this.filterJobsByPeriod(this.data.jobs);
    const completedJobs = periodJobs.filter(job => job.status === 'Completed');
    const completedOnTime = completedJobs.filter(job => {
      if (!job.completed_date) return false;
      const jobDate = new Date(job.job_date);
      const completedDate = new Date(job.completed_date);
      const daysDiff = (completedDate.getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 3; // Considered on-time if completed within 3 days
    });

    const rate = periodJobs.length > 0 ? (completedOnTime.length / periodJobs.length) * 100 : 0;

    return {
      value: Math.round(rate * 100) / 100,
      label: 'Job Completion Rate',
      unit: '%',
      trend: rate > 85 ? 'up' : rate < 75 ? 'down' : 'neutral',
      change: 0, // Would need historical data for actual change
      period: this.period,
    };
  }

  // 2. Average Job Duration
  calculateAverageJobDuration(): KPIResult {
    const periodJobs = this.filterJobsByPeriod(this.data.jobs);
    const completedJobs = periodJobs.filter(job => job.status === 'Completed' && job.completed_date);
    
    if (completedJobs.length === 0) {
      return {
        value: 0,
        label: 'Average Job Duration',
        unit: 'hours',
        trend: 'neutral',
        change: 0,
        period: this.period,
      };
    }

    const durations = completedJobs.map(job => {
      const start = new Date(job.job_date);
      const end = new Date(job.completed_date!);
      return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    });

    const avgDuration = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;

    return {
      value: Math.round(avgDuration * 100) / 100,
      label: 'Average Job Duration',
      unit: 'hours',
      trend: avgDuration < 4 ? 'up' : avgDuration > 8 ? 'down' : 'neutral',
      change: 0,
      period: this.period,
    };
  }

  // 3. Technician Utilization
  calculateTechnicianUtilization(): KPIResult {
    const activeStaff = this.data.staff.filter(staff => staff.active);
    const periodActivities = this.data.job_activities.filter(activity => {
      const activityDate = new Date(activity.start_time);
      return activityDate >= this.getDateRange();
    });

    if (activeStaff.length === 0 || periodActivities.length === 0) {
      return {
        value: 0,
        label: 'Technician Utilization',
        unit: '%',
        trend: 'neutral',
        change: 0,
        period: this.period,
      };
    }

    const totalBillableHours = periodActivities.reduce((sum, activity) => {
      if (!activity.end_time) return sum;
      const start = new Date(activity.start_time);
      const end = new Date(activity.end_time);
      return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }, 0);

    const availableHours = activeStaff.length * 8 * 5; // 8 hours/day, 5 days/week
    const utilization = (totalBillableHours / availableHours) * 100;

    return {
      value: Math.round(utilization * 100) / 100,
      label: 'Technician Utilization',
      unit: '%',
      trend: utilization > 75 ? 'up' : utilization < 60 ? 'down' : 'neutral',
      change: 0,
      period: this.period,
    };
  }

  // 4. Customer Satisfaction Score
  calculateCustomerSatisfaction(): KPIResult {
    const periodJobs = this.filterJobsByPeriod(this.data.jobs);
    const completedJobs = periodJobs.filter(job => job.status === 'Completed');
    
    if (completedJobs.length === 0) {
      return {
        value: 0,
        label: 'Customer Satisfaction',
        unit: 'score',
        trend: 'neutral',
        change: 0,
        period: this.period,
      };
    }

    // Simplified satisfaction score based on payment speed and repeat customers
    const uniqueCompanies = new Set(completedJobs.map(job => job.company_uuid));
    const repeatCustomers = new Set();
    
    const companyJobCounts = new Map();
    completedJobs.forEach(job => {
      const count = companyJobCounts.get(job.company_uuid) || 0;
      companyJobCounts.set(job.company_uuid, count + 1);
      if (count > 0) {
        repeatCustomers.add(job.company_uuid);
      }
    });

    const repeatRate = repeatCustomers.size / uniqueCompanies.size;
    const satisfactionScore = (repeatRate * 100) + (completedJobs.length / 10); // Bonus for volume

    return {
      value: Math.min(Math.round(satisfactionScore * 10) / 10, 100),
      label: 'Customer Satisfaction',
      unit: 'score',
      trend: satisfactionScore > 80 ? 'up' : satisfactionScore < 60 ? 'down' : 'neutral',
      change: 0,
      period: this.period,
    };
  }

  // 5. Average Job Value
  calculateAverageJobValue(): KPIResult {
    const periodJobs = this.filterJobsByPeriod(this.data.jobs);
    const completedJobs = periodJobs.filter(job => job.status === 'Completed');
    
    if (completedJobs.length === 0) {
      return {
        value: 0,
        label: 'Average Job Value',
        unit: '$',
        trend: 'neutral',
        change: 0,
        period: this.period,
      };
    }

    const totalValue = completedJobs.reduce((sum, job) => sum + (job.total || 0), 0);
    const avgValue = totalValue / completedJobs.length;

    return {
      value: Math.round(avgValue * 100) / 100,
      label: 'Average Job Value',
      unit: '$',
      trend: avgValue > 500 ? 'up' : avgValue < 200 ? 'down' : 'neutral',
      change: 0,
      period: this.period,
    };
  }

  // 6. First-Time Fix Rate
  calculateFirstTimeFixRate(): KPIResult {
    const periodJobs = this.filterJobsByPeriod(this.data.jobs);
    const completedJobs = periodJobs.filter(job => job.status === 'Completed');
    
    if (completedJobs.length === 0) {
      return {
        value: 0,
        label: 'First-Time Fix Rate',
        unit: '%',
        trend: 'neutral',
        change: 0,
        period: this.period,
      };
    }

    // Simplified: jobs completed within 1 visit (no follow-up jobs for same company within 7 days)
    const firstTimeFixJobs = completedJobs.filter(job => {
      const jobDate = new Date(job.job_date);
      const followUpJobs = this.data.jobs.filter(otherJob => 
        otherJob.company_uuid === job.company_uuid && otherJob.uuid !== job.uuid
        && Math.abs(new Date(otherJob.job_date).getTime() - jobDate.getTime()) < (7 * 24 * 60 * 60 * 1000)
      );
      return followUpJobs.length === 0;
    });

    const fixRate = (firstTimeFixJobs.length / completedJobs.length) * 100;

    return {
      value: Math.round(fixRate * 100) / 100,
      label: 'First-Time Fix Rate',
      unit: '%',
      trend: fixRate > 85 ? 'up' : fixRate < 70 ? 'down' : 'neutral',
      change: 0,
      period: this.period,
    };
  }

  getAllKPIs(): KPIResult[] {
    return [
      this.calculateJobCompletionRate(),
      this.calculateAverageJobDuration(),
      this.calculateTechnicianUtilization(),
      this.calculateAverageJobValue(),
    ];
  }
}
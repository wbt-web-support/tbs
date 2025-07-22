// Import ServiceM8KPI from TypeScript file
import('./lib/servicem8-kpi.ts').then(async ({ ServiceM8KPI }) => {

// Sample ServiceM8 data for testing
const sampleData = {
  jobs: [
    {
      uuid: "job-1",
      job_number: "JOB-001",
      job_date: "2025-01-15T09:00:00Z",
      completed_date: "2025-01-16T17:00:00Z",
      status: "Completed",
      company_uuid: "company-1",
      staff_uuid: "staff-1",
      total: 450.00,
      description: "Plumbing repair"
    },
    {
      uuid: "job-2", 
      job_number: "JOB-002",
      job_date: "2025-01-18T08:30:00Z",
      completed_date: "2025-01-19T15:30:00Z",
      status: "Completed",
      company_uuid: "company-2",
      staff_uuid: "staff-1",
      total: 320.00,
      description: "HVAC maintenance"
    },
    {
      uuid: "job-3",
      job_number: "JOB-003", 
      job_date: "2025-01-20T10:00:00Z",
      completed_date: null,
      status: "In Progress",
      company_uuid: "company-1",
      staff_uuid: "staff-2",
      total: 0,
      description: "Electrical installation"
    }
  ],
  staff: [
    {
      uuid: "staff-1",
      first_name: "John",
      last_name: "Smith",
      email: "john@company.com",
      active: true
    },
    {
      uuid: "staff-2", 
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@company.com",
      active: true
    }
  ],
  companies: [
    {
      uuid: "company-1",
      name: "ABC Corp",
      email: "contact@abc.com",
      phone: "555-0001"
    },
    {
      uuid: "company-2",
      name: "XYZ Ltd", 
      email: "info@xyz.com",
      phone: "555-0002"
    }
  ],
  job_activities: [
    {
      uuid: "activity-1",
      job_uuid: "job-1",
      staff_uuid: "staff-1", 
      start_time: "2025-01-15T09:00:00Z",
      end_time: "2025-01-15T17:00:00Z",
      description: "Repair work"
    },
    {
      uuid: "activity-2",
      job_uuid: "job-2", 
      staff_uuid: "staff-1",
      start_time: "2025-01-18T08:30:00Z",
      end_time: "2025-01-18T16:30:00Z", 
      description: "Maintenance work"
    }
  ]
};

console.log('🧪 Testing ServiceM8 KPI Calculations...\n');

try {
  const kpiEngine = new ServiceM8KPI(sampleData, 'monthly');
  const kpis = kpiEngine.getAllKPIs();
  
  console.log('📊 ServiceM8 KPI Results:');
  console.log('========================');
  
  kpis.forEach((kpi, index) => {
    console.log(`${index + 1}. ${kpi.label}: ${kpi.value}${kpi.unit} (${kpi.trend})`);
  });
  
  console.log('\n✅ ServiceM8 KPI calculations completed successfully!');
  
} catch (error) {
  console.error('❌ Error testing ServiceM8 KPIs:', error);
}
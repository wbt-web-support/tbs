import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { ServiceM8KPI } from '@/lib/servicem8-kpi'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'monthly'
    
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      )
    }

    const { data } = await supabase
      .from('servicem8_data')
      .select('jobs, staff, companies, job_activities, job_materials')
      .eq('user_id', user.id)
      .single()

    if (!data) {
      return NextResponse.json(
        { error: 'No ServiceM8 data found' },
        { status: 404 }
      )
    }

    // Filter companies: only active and not 'Help Guide Job'
    const filteredCompanies = (data.companies || []).filter(
      c => (c.active === 1 || c.active === true) && c.name && c.name.toLowerCase() !== 'help guide job'
    );

    // Filter staff: only active and not API keys or integration users
    const filteredStaff = (data.staff || []).filter(
      s => (s.active === 1 || s.active === true) &&
        s.first !== '(API Key)' &&
        s.first !== 'Trade Business School Integration'
    );

    const serviceData = {
      jobs: (data.jobs || []).map(job => ({
        uuid: job.uuid,
        job_number: job.generated_job_id || job.job_number || '',
        job_date: job.date, // Map 'date' to 'job_date'
        completed_date: job.completion_date, // Map 'completion_date' to 'completed_date'
        status: job.status,
        company_uuid: job.company_uuid,
        staff_uuid: job.created_by_staff_uuid,
        total: parseFloat(job.total_invoice_amount || '0'), // Map and parse
        description: job.job_description || '',
      })),
      staff: filteredStaff,
      companies: filteredCompanies,
      job_activities: data.job_activities || [],
      job_materials: data.job_materials || [],
    }

    const kpiEngine = new ServiceM8KPI(serviceData, period)
    const kpis = kpiEngine.getAllKPIs()

    return NextResponse.json({ kpis })
  } catch (error) {
    console.error('ServiceM8 KPIs error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate KPIs' },
      { status: 500 }
    )
  }
}
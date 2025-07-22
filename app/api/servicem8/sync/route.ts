import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { ServiceM8API } from '@/lib/servicem8-api'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      )
    }

    // Update sync status
    await supabase
      .from('servicem8_data')
      .update({
        sync_status: 'syncing',
        last_sync_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    const api = new ServiceM8API(supabase)
    
    try {
      const data = await api.getAllData(user.id)

      // Update database with synced data
      const { error } = await supabase
        .from('servicem8_data')
        .update({
          jobs: data.jobs,
          staff: data.staff,
          companies: data.companies,
          job_activities: data.job_activities,
          job_materials: data.job_materials,
          sync_status: 'completed',
          last_sync_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('user_id', user.id)

      if (error) {
        throw error
      }

      return NextResponse.json({
        success: true,
        jobs: data.jobs.length,
        staff: data.staff.length,
        companies: data.companies.length,
        job_activities: data.job_activities.length,
        job_materials: data.job_materials.length,
      })

    } catch (syncError) {
      // Update sync status with error
      await supabase
        .from('servicem8_data')
        .update({
          sync_status: 'error',
          error_message: syncError instanceof Error ? syncError.message : 'Unknown sync error',
        })
        .eq('user_id', user.id)

      throw syncError
    }

  } catch (error) {
    console.error('ServiceM8 sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync ServiceM8 data' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
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
      .select('sync_status, last_sync_at, error_message, connected_at, jobs, staff, companies')
      .eq('user_id', user.id)
      .single()

    if (!data) {
      return NextResponse.json({
        connected: false,
        sync_status: 'disconnected',
        last_sync_at: null,
        error_message: null,
        jobs: [],
        staff: [],
        companies: []
      })
    }

    return NextResponse.json({
      connected: !!data.connected_at,
      sync_status: data.sync_status || 'pending',
      last_sync_at: data.last_sync_at,
      error_message: data.error_message,
      jobs: data.jobs || [],
      staff: data.staff || [],
      companies: data.companies || []
    })

  } catch (error) {
    console.error('ServiceM8 sync status error:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}
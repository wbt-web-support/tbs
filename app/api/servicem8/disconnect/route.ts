import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { ServiceM8API } from '@/lib/servicem8-api'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      )
    }

    const api = new ServiceM8API(supabase)
    await api.disconnect(user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('ServiceM8 disconnect error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect ServiceM8' },
      { status: 500 }
    )
  }
}
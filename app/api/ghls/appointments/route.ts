import { NextRequest, NextResponse } from 'next/server';
import { getGHLService } from '@/lib/ghl-api';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ghlService = await getGHLService(user.id);
    if (!ghlService) {
      return NextResponse.json({ error: 'GHL Integration not found or inactive' }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const appointments = await ghlService.getAppointments({ startDate, endDate });
    return NextResponse.json({ appointments });

  } catch (error: any) {
    console.error('Error fetching GHL appointments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch appointments' },
      { status: 500 }
    );
  }
}

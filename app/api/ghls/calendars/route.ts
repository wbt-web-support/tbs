
import { NextRequest, NextResponse } from 'next/server';
import { getGHLService } from '@/lib/ghl-api';
import { createClient } from '@/utils/supabase/server';

// Get calendars or available slots
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
    const calendarId = searchParams.get('calendarId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (calendarId && startDate && endDate) {
        // Fetch slots
        const slots = await ghlService.getCalendarSlots(calendarId, startDate, endDate);
        return NextResponse.json({ slots });
    } else {
        // Fetch list of calendars
        const calendars = await ghlService.getCalendars();
        return NextResponse.json({ calendars });
    }

  } catch (error: any) {
    console.error('Error fetching GHL calendars:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch calendars' },
      { status: 500 }
    );
  }
}

// Create Appointment
export async function POST(req: NextRequest) {
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
    
        const body = await req.json();
        
        // Validate required fields
        if (!body.calendarId || !body.startTime || !body.endTime || !body.contactId) {
             return NextResponse.json({ error: 'Missing required fields: calendarId, startTime, endTime, contactId' }, { status: 400 });
        }

        const result = await ghlService.createAppointment({
            calendarId: body.calendarId,
            startTime: body.startTime,
            endTime: body.endTime,
            title: body.title || 'Meeting',
            description: body.description,
            contactId: body.contactId,
            email: body.email,
            phone: body.phone
        });
    
        return NextResponse.json(result);
      } catch (error: any) {
        console.error('Error creating GHL appointment:', error);
        return NextResponse.json(
          { error: error.message || 'Failed to create appointment' },
          { status: 500 }
        );
      }
}

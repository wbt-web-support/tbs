
import { NextRequest, NextResponse } from 'next/server';
import { getGHLService } from '@/lib/ghl-api';
import { createClient } from '@/utils/supabase/server';

// Create a new contact
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
    const result = await ghlService.createContact(body);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error creating GHL contact:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create contact' },
      { status: 500 }
    );
  }
}

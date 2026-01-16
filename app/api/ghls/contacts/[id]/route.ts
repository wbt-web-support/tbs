import { NextRequest, NextResponse } from 'next/server';
import { getGHLService, saveGHLContactCache } from '@/lib/ghl-api';
import { createClient } from '@/utils/supabase/server';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    const ghlService = await getGHLService(user.id);
    if (!ghlService) {
      return NextResponse.json({ error: 'GHL Integration not found or inactive' }, { status: 404 });
    }

    const body = await req.json();
    const result = await ghlService.updateContact(id, body);

    // Cache the updated contact
    if (result && result.contact) {
        await saveGHLContactCache(user.id, {
            ...result.contact,
            id: result.contact.id // Ensure ID is present
        });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error updating GHL contact:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update contact' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    const ghlService = await getGHLService(user.id);
    if (!ghlService) {
      return NextResponse.json({ error: 'GHL Integration not found or inactive' }, { status: 404 });
    }

    await ghlService.deleteContact(id);

    // Remove from local cache
    // We reuse the existing authenticated supabase client for this operation
    const { error } = await supabase
      .from('ghl_contacts_cache')
      .delete()
      .eq('ghl_contact_id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error removing contact from cache:', error);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting GHL contact:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete contact' },
      { status: 500 }
    );
  }
}

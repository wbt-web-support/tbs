import { NextRequest, NextResponse } from 'next/server';
import { getGHLService, saveGHLContactCache } from '@/lib/ghl-api';
import { createClient } from '@/utils/supabase/server';

// Get contacts (List/Search with Sync option)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sync = searchParams.get('sync') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const query = searchParams.get('query') || '';

    const ghlService = await getGHLService(user.id);
    if (!ghlService) {
      return NextResponse.json({ error: 'GHL Integration not found or inactive' }, { status: 404 });
    }

    // If sync requested, fetch from GHL and update cache
    if (sync) {
      console.log('🔄 Syncing contacts from GHL...');
      const response = await ghlService.getContacts({ limit, offset, query });
      
      // Save to cache in background-ish (awaiting for now for simplicity)
      for (const contact of response.contacts) {
        await saveGHLContactCache(user.id, contact);
      }
      
      // Fall through to query the DB so we return formatted data
    }

    // Default: Check local cache first
    let dbQuery = supabase
      .from('ghl_contacts_cache')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .range(offset, offset + limit - 1)
      .order('date_added', { ascending: false });

    if (query) {
      dbQuery = dbQuery.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`);
    }

    const { data: contacts, count, error: dbError } = await dbQuery;

    if (dbError) throw dbError;

    // If no contacts in cache and not a search, try a quick sync
    if ((!contacts || contacts.length === 0) && !query && offset === 0) {
      console.log('empty cache, auto-syncing...');
      const response = await ghlService.getContacts({ limit, offset });
      for (const contact of response.contacts) {
        await saveGHLContactCache(user.id, contact);
      }
      return NextResponse.json(response);
    }

    return NextResponse.json({
      contacts: contacts || [],
      meta: {
        total: count || 0,
        limit,
        offset
      }
    });

  } catch (error: any) {
    console.error('Error fetching GHL contacts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

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

    // Cache the newly created contact if successful
    if (result && (result.contact || result.id)) {
        const contactToCache = result.contact || result;
        if (contactToCache.id) {
             await saveGHLContactCache(user.id, contactToCache);
        }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error creating GHL contact:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create contact' },
      { status: 500 }
    );
  }
}

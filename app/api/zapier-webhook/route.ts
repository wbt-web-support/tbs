import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Received Zapier webhook:', body);

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get the user ID from the webhook payload
    const userId = body.user_id;
    if (!userId) {
      console.error('User ID not provided in webhook payload');
      return NextResponse.json({ error: 'User ID is required in the webhook payload' }, { status: 400 });
    }
    console.log('Extracted userId:', userId);

    // Fetch user-defined mappings
    const { data: mappings, error: mappingsError } = await supabase
      .from('zapier_mappings')
      .select('zapier_field_name, internal_field_name')
      .eq('user_id', userId);

    if (mappingsError) {
      console.error('Error fetching mappings:', mappingsError);
      return NextResponse.json({ error: mappingsError.message }, { status: 500 });
    }
    console.log('Fetched mappings:', mappings);

    const webhookData: { [key: string]: any } = {
      source_app: body.source_app || 'unknown',
      event_type: body.event_type || 'unknown',
      raw_payload: body,
      user_id: userId,
    };

    // Apply mappings
    if (mappings) {
      mappings.forEach(mapping => {
        const zapierValue = body[mapping.zapier_field_name];
        console.log(`Mapping: ${mapping.zapier_field_name} (Zapier) -> ${mapping.internal_field_name} (Internal). Value:`, zapierValue);
        if (zapierValue !== undefined) {
          webhookData[mapping.internal_field_name] = zapierValue;
        }
      });
    }
    console.log('Webhook data before insert:', webhookData);

    const { data, error } = await supabase.from('zapier_webhooks').insert([
      webhookData
    ]);

    if (error) {
      console.error('Error inserting webhook data:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Webhook received and processed', data });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 
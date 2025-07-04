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
      .select('id, zapier_field_name, internal_field_name, sample_value')
      .eq('user_id', userId);

    if (mappingsError) {
      console.error('Error fetching mappings:', mappingsError);
      return NextResponse.json({ error: mappingsError.message }, { status: 500 });
    }
    console.log('Fetched mappings:', mappings);

    // Update sample values for existing mappings if new data is available
    if (mappings && mappings.length > 0) {
      const mappingUpdates = [];
      
      for (const mapping of mappings) {
        const zapierFieldName = mapping.zapier_field_name;
        const newValue = body[zapierFieldName];
        
        // Only update if the field exists in the webhook payload and has a value
        if (newValue !== undefined && newValue !== null) {
          const newSampleValue = String(newValue);
          
          // Only update if the sample value is different from the current one
          if (mapping.sample_value !== newSampleValue) {
            mappingUpdates.push({
              id: mapping.id,
              sample_value: newSampleValue
            });
          }
        }
      }

      // Batch update all mappings that need updating
      if (mappingUpdates.length > 0) {
        console.log('Updating mappings with new sample values:', mappingUpdates);
        
        for (const update of mappingUpdates) {
          const { error: updateError } = await supabase
            .from('zapier_mappings')
            .update({ sample_value: update.sample_value })
            .eq('id', update.id);

          if (updateError) {
            console.error('Error updating mapping:', updateError);
            // Continue with other updates even if one fails
          }
        }
      }
    }

    // Prepare webhook data for insertion
    const webhookData: { [key: string]: any } = {
      source_app: body.source_app || 'unknown',
      event_type: body.event_type || 'unknown',
      raw_payload: body,
      user_id: userId,
    };

    console.log('Webhook data before insert:', webhookData);

    // Insert the webhook data
    const { data, error } = await supabase.from('zapier_webhooks').insert([
      webhookData
    ]);

    if (error) {
      console.error('Error inserting webhook data:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return success response with information about updates
    const response = {
      message: 'Webhook received and processed',
      data,
      mappings_updated: mappings ? mappings.length : 0
    };

    console.log('Webhook processed successfully:', response);
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
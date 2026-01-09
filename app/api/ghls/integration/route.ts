
import { NextRequest, NextResponse } from 'next/server';
import { getGHLIntegration } from '@/lib/ghl-api';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integration = await getGHLIntegration(user.id);

    return NextResponse.json({ 
        isConnected: !!integration,
        integration: integration ? {
            locationId: integration.location_id,
            companyId: integration.company_id,
            userType: integration.user_type,
            updatedAt: integration.updated_at
        } : null
    });
  } catch (error: any) {
    console.error('Error checking GHL integration status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    );
  }
}

// Disconnect endpoint
export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
    
        if (!user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    
        await supabase
            .from('ghl_integrations')
            .update({ is_active: false })
            .eq('user_id', user.id);
    
        return NextResponse.json({ success: true });
      } catch (error: any) {
        console.error('Error disconnecting GHL:', error);
        return NextResponse.json(
          { error: error.message || 'Failed to disconnect' },
          { status: 500 }
        );
      }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { competitorData } = await request.json();
    
    if (!competitorData) {
      return NextResponse.json(
        { error: 'Competitor data is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user already has onboarding data
    const { data: existingOnboarding } = await supabase
      .from('company_onboarding')
      .select('id, competitor_data')
      .eq('user_id', user.id)
      .single();

    let updatedCompetitorData;
    
    if (existingOnboarding) {
      // Update existing record
      const currentData = existingOnboarding.competitor_data || {};
      
      // Merge new competitor data with existing data
      updatedCompetitorData = {
        ...currentData,
        ...competitorData
      };

      await supabase
        .from('company_onboarding')
        .update({
          competitor_data: updatedCompetitorData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
    } else {
      // Create new record
      updatedCompetitorData = competitorData;
      
      await supabase
        .from('company_onboarding')
        .insert({
          user_id: user.id,
          onboarding_data: {},
          competitor_data: updatedCompetitorData
        });
    }

    return NextResponse.json({
      success: true,
      data: updatedCompetitorData
    });

  } catch (error) {
    console.error('Error saving competitor data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save competitor data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

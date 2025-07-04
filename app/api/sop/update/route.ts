import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/utils/supabase/server';
import { getTeamId } from '@/utils/supabase/teams';
import { responseQualityOptimizer } from '@/lib/response-quality-optimizer';

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not set in the environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamId = await getTeamId(supabase, user.id);
    const { sopId, editPrompt, currentContent, feedback, tone, format } = await req.json();

    if (!sopId || !editPrompt || !currentContent) {
      return NextResponse.json({ 
        error: "SOP ID, edit prompt, and current content are required" 
      }, { status: 400 });
    }

    // Verify SOP ownership for the team
    const { data: existingSop, error: sopError } = await supabase
      .from('sop_data')
      .select('*')
      .eq('id', sopId)
      .eq('user_id', teamId)
      .single();

    if (sopError || !existingSop) {
      return NextResponse.json({ error: "SOP not found or access denied" }, { status: 404 });
    }

    // Build prompt for SOP editing
    const prompt = `
      **Objective:** Update an existing Standard Operating Procedure (SOP) based on user feedback.
      
      **Current SOP Content:**
      ${currentContent}
      
      **User Feedback for Updates:**
      ${feedback}
      
      **Required Tone:** ${tone}
      **Required Format:** ${format}
      
      Please generate the updated SOP based on the provided details and feedback.
    `;
    
    const qualityEnhancement = responseQualityOptimizer.getPromptEnhancement('sop-update', feedback, 'text');
    const generationConfig = responseQualityOptimizer.getGenerationConfig('sop-update', 'text');

    // Generate updated SOP using Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt + qualityEnhancement }] }],
      generationConfig,
    });

    const response = result.response;
    const updatedContent = response.text();

    // Mark current SOP as not current for the team
    await supabase
      .from('sop_data')
      .update({ is_current: false })
      .eq('user_id', teamId)
      .eq('is_current', true);

    // Create new version for the team
    const newVersion = existingSop.version + 1;
    const { data: newSop, error: insertError } = await supabase
      .from('sop_data')
      .insert({
        user_id: teamId,
        title: existingSop.title,
        content: updatedContent,
        version: newVersion,
        is_current: true,
        parent_sop_id: existingSop.parent_sop_id || existingSop.id,
        metadata: {
          ...existingSop.metadata,
          edit_prompt: editPrompt,
          edited_date: new Date().toISOString(),
          previous_version: existingSop.version
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating new SOP version:", insertError);
      return NextResponse.json({ error: "Failed to update SOP" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sop: newSop
    });

  } catch (error: any) {
    console.error("SOP Update Error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to update SOP" 
    }, { status: 500 });
  }
} 
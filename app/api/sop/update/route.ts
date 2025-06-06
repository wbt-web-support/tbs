import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/utils/supabase/server';

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

    const { sopId, editPrompt, currentContent } = await req.json();

    if (!sopId || !editPrompt || !currentContent) {
      return NextResponse.json({ 
        error: "SOP ID, edit prompt, and current content are required" 
      }, { status: 400 });
    }

    // Verify SOP ownership
    const { data: existingSop, error: sopError } = await supabase
      .from('sop_data')
      .select('*')
      .eq('id', sopId)
      .eq('user_id', user.id)
      .single();

    if (sopError || !existingSop) {
      return NextResponse.json({ error: "SOP not found or access denied" }, { status: 404 });
    }

    // Build prompt for SOP editing
    const prompt = `You are an expert business consultant helping to revise a Standard Operating Procedure (SOP) document.

CURRENT SOP CONTENT:
${currentContent}

USER'S EDIT REQUEST:
${editPrompt}

Please revise the SOP based on the user's request. Maintain the professional format and structure while incorporating the requested changes. 

REQUIREMENTS:
- Keep the existing structure unless specifically asked to change it
- Maintain professional tone and UK English
- Ensure all changes are practical and implementable
- Keep the content comprehensive and detailed
- Use clear headings, bullet points, and numbered lists
- Make sure the revised content flows naturally
- Increase the version number by +1 so if it's 2 then it will be 3 every time you update the SOP don't use decimal points like 2.1 or 2.2 etc.

Return the complete revised SOP document.`;

    // Generate updated SOP using Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite-001" });
    const result = await model.generateContent(prompt);
    const updatedContent = result.response.text();

    // Mark current SOP as not current
    await supabase
      .from('sop_data')
      .update({ is_current: false })
      .eq('user_id', user.id)
      .eq('is_current', true);

    // Create new version
    const newVersion = existingSop.version + 1;
    const { data: newSop, error: insertError } = await supabase
      .from('sop_data')
      .insert({
        user_id: user.id,
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
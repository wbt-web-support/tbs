import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { file_id } = await req.json();

    if (!file_id) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 });
    }

    // Get the extracted text and metadata
    const { data: fileData, error: fileError } = await supabase
      .from("finance_files")
      .select("extracted_text, team_id, file_name, month, year, period_type")

      .eq("id", file_id)
      .single();

    if (fileError || !fileData) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (!fileData.extracted_text) {
      return NextResponse.json({ error: "No extracted text found for this file. Please re-upload." }, { status: 400 });
    }

    // Prepare Gemini prompt
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = `
      You are a professional financial analyst. Analyze the following extracted text from a financial document (${fileData.file_name}) for the ${fileData.period_type} period of ${fileData.period_type === 'monthly' ? fileData.month : ''} ${fileData.year}.

      
      Extract and provide the analysis in a strict JSON format.
      
      The JSON must include:
      1. "summary": A brief professional overview of the financial health shown.
      2. "kpis": {
          "total_revenue": number,
          "total_expenses": number,
          "net_profit": number,
          "profit_margin": number (percentage)
      }
      3. "charts": {
          "revenue_vs_expense": [
            {"label": "Revenue", "value": number},
            {"label": "Expense", "value": number}
          ],
          "expense_breakdown": [
            {"category": string, "value": number}
          ]
      }
      4. "insights": string[] (list of 3-5 key observations or recommendations)

      If specific numbers are missing, provide your best estimate based on the text or set them to 0. 
      Do not include any text outside of the JSON block.

      TEXT TO ANALYZE:
      ${fileData.extracted_text}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean up response if it contains markdown code blocks
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const analysisResult = JSON.parse(text);

    // Store in finance_analysis table
    const { data: analysisData, error: analysisError } = await supabase
      .from("finance_analysis")
      .insert({
        file_id: file_id,
        user_id: user.id,
        team_id: fileData.team_id,
        analysis_result: analysisResult,
        summary: analysisResult.summary || "",
        status: 'completed',
        period_type: fileData.period_type
      })

      .select()
      .single();

    if (analysisError) {
      console.error("Database save error:", analysisError);
      return NextResponse.json({ error: "Failed to save analysis result" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      analysis: analysisData 
    });

  } catch (error) {
    console.error("AI Analysis error:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}

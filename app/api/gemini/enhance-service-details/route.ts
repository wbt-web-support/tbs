import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from "@/utils/supabase/server";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const MODEL_NAME = "gemini-2.0-flash-lite-001";

const genAI = new GoogleGenerativeAI(API_KEY);

// Helper function to get company onboarding data
async function getCompanyOnboardingData(userId: string) {
  try {
    const supabase = await createClient();
    const { data: onboardingData } = await supabase
      .from('company_onboarding')
      .select('*')
      .eq('user_id', userId)
      .single();

    return onboardingData;
  } catch (error) {
    console.error("Error fetching company onboarding data:", error);
    return null;
  }
}

// Helper function to format company context
function formatCompanyContext(onboardingData: any) {
  if (!onboardingData?.onboarding_data) {
    return "";
  }

  const data = onboardingData.onboarding_data;
  let context = "## COMPANY CONTEXT\n\n";

  if (data.company_name) context += `- Company Name: ${data.company_name}\n`;
  if (data.industry) context += `- Industry: ${data.industry}\n`;
  if (data.company_size) context += `- Company Size: ${data.company_size}\n`;
  if (data.business_description) {
    context += `\n### Business Description:\n${data.business_description}\n`;
  }
  if (data.target_market) {
    context += `\n### Target Market:\n${data.target_market}\n`;
  }
  if (data.unique_value_proposition) {
    context += `\n### Unique Value Proposition:\n${data.unique_value_proposition}\n`;
  }

  return context;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { service_name, business_details } = body;

    if (!business_details || !business_details.trim()) {
      return NextResponse.json(
        { error: "Business details are required" },
        { status: 400 }
      );
    }

    // Fetch company onboarding data for context
    const onboardingData = await getCompanyOnboardingData(user.id);
    const companyContext = formatCompanyContext(onboardingData);

    // Build the AI prompt
    const prompt = `You are an AI assistant helping a business owner improve their service description.

${companyContext ? `${companyContext}\n\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## SERVICE: ${service_name || 'Business Service'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## CURRENT SERVICE DESCRIPTION:
${business_details}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## TASK: Enhance and Rewrite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL INSTRUCTIONS:
- You MUST rewrite and improve the user's existing service description
- Do NOT provide feedback, commentary, or analysis about the content
- Do NOT say things like "Your description is clear" or "The content is well-written"
- Do NOT provide suggestions - just return the improved version
- ONLY return the actual improved content, nothing else
- Improve clarity, structure, and flow of the existing content
- Fix any grammatical or spelling errors (use UK English)
- Make the language more professional and compelling
- Keep the same core meaning and information
- Focus on enhancing what's already there without adding made-up information
- Make it more detailed about specialities, types of work, and target customers
- If you cannot improve the content meaningfully, return the original content exactly as provided
- Return ONLY plain text without ANY markdown formatting, asterisks, or special characters

Return ONLY the enhanced service description text.`;

    // Use the generative model
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1000,
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let enhancedContent = response.text();

    // Remove any markdown formatting
    enhancedContent = enhancedContent
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*[-*+]\s/gm, '')
      .trim();

    // Check for meta-feedback responses
    const metaFeedbackPatterns = [
      /your.*description.*is.*clear/gi,
      /your.*content.*is.*well/gi,
      /your.*original.*description/gi,
      /the.*content.*flows.*well/gi,
      /effectively.*communicates/gi,
      /well-structured/gi,
    ];
    
    const containsMetaFeedback = metaFeedbackPatterns.some(pattern => pattern.test(enhancedContent));
    
    if (containsMetaFeedback) {
      // If meta-feedback detected, try again with stronger instructions
      const cleanupPrompt = `${prompt}\n\nSTRICT REQUIREMENT: You must rewrite the content, not comment on it. Do not say "your description is..." or "the content is...". Just rewrite and improve the actual service description.`;
      try {
        const cleanupResult = await model.generateContent(cleanupPrompt);
        enhancedContent = cleanupResult.response.text();
      } catch (error) {
        // If cleanup fails, return original content
        enhancedContent = business_details;
      }
    }

    // Ensure the enhanced content is meaningful
    if (enhancedContent.length < business_details.length * 0.5) {
      // If too short, return original
      enhancedContent = business_details;
    }

    return NextResponse.json({ 
      success: true,
      enhancedContent: enhancedContent.trim()
    });

  } catch (error: any) {
    console.error("Error enhancing service details:", error);
    return NextResponse.json(
      { error: error.message || "Failed to enhance service details" },
      { status: 500 }
    );
  }
}

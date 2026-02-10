import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from "@/utils/supabase/server";

// Ensure the API key is available
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not set in the environment variables.");
}
 
const genAI = new GoogleGenerativeAI(apiKey);

// Helper function to get user ID from request
async function getUserId(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id; 
  } catch (error) {
    console.error("Error getting user session:", error);
    return null;
  }
}

// Helper function to get user business info and onboarding data
async function getUserContext(userId: string) {
  if (!userId) return null;

  try {
    const supabase = await createClient();
    
    // Fetch business info
    const { data: businessInfo, error: businessError } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (businessError && businessError.code !== "PGRST116") {
      console.error("Error fetching business info:", businessError);
    }
    
    // Fetch onboarding data
    const { data: onboardingData, error: onboardingError } = await supabase
      .from('company_onboarding')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (onboardingError && onboardingError.code !== "PGRST116") {
      console.error("Error fetching onboarding data:", onboardingError);
    }

    return {
      businessInfo: businessInfo || null,
      onboardingData: onboardingData || null
    };
  } catch (error) {
    console.error("Error fetching user context:", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { content, action, selectedText, context } = await req.json();

    if (!content || !action) {
      return NextResponse.json({ error: "Content and action are required." }, { status: 400 });
    }

    // Get user context for better AI assistance
    const userId = await getUserId(req);
    const userContext = userId ? await getUserContext(userId) : null;
    
    // Prepare user context string for the AI
    let userContextString = '';
    if (userContext) {
      const parts = [];
      
      if (userContext.businessInfo) {
        const info = userContext.businessInfo;
        parts.push(`Business Information:
- Business Name: ${info.business_name || 'Not specified'}
- Full Name: ${info.full_name || 'Not specified'}
- Role: ${info.role || 'Not specified'}
- Job Title: ${info.job_title || 'Not specified'}
- Department: ${info.department || 'Not specified'}`);
      }
      
      if (userContext.onboardingData) {
        const onboarding = userContext.onboardingData;
        parts.push(`Onboarding Status: ${onboarding.completed ? 'Completed' : 'In Progress'}`);
        if (onboarding.onboarding_data) {
          parts.push(`Onboarding Data: ${JSON.stringify(onboarding.onboarding_data)}`);
        }
      }
      
      if (parts.length > 0) {
        userContextString = `\n\nUSER CONTEXT:\n${parts.join('\n\n')}\n\n`;
      }
    }

    // Define prompts for each action
    const HTML_RULES = `
CRITICAL HTML RULES:
- The input is HTML. Your output MUST also be valid HTML.
- Preserve ALL existing HTML tags exactly: <h1>, <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>, <a>, <blockquote>, <code>, <table>, <tr>, <td>, <th>, etc.
- Do NOT strip or flatten HTML formatting. If text is bold (<strong>), keep it bold. If it's a list (<ul><li>), keep it as a list.
- Do NOT convert HTML to plain text or Markdown.
- Do NOT wrap your response in \`\`\`html code fences or any markdown formatting.
- Return ONLY the raw HTML content, nothing else.`;

    const prompts = {
      simplify: `You are an AI HTML editor. Simplify the following HTML content — make it easier to understand and more concise while keeping the core meaning. Use UK English.${userContextString}
${HTML_RULES}

INPUT HTML:
${content}`,

      grammar: `You are an AI HTML editor. Fix any spelling and grammar errors in the following HTML content. Maintain the original tone and meaning. Convert any US English to UK English.${userContextString}
${HTML_RULES}

INPUT HTML:
${content}`,

      shorter: `You are an AI HTML editor. Make the following HTML content shorter while preserving all key information and main points. Be concise but comprehensive. Use UK English.${userContextString}
${HTML_RULES}

INPUT HTML:
${content}`,

      longer: `You are an AI HTML editor. Expand the following HTML content with more detail, examples, and explanations. Enhance the content without changing the core message. Use UK English.${userContextString}
${HTML_RULES}

INPUT HTML:
${content}`,

      format: `You are an HTML formatter. Your ONLY job is to improve the HTML structure of the following content.${userContextString}

RULES:
- DO NOT change ANY text content — keep every word exactly the same.
- DO NOT add any new content, examples, or explanations.
- Convert plain text titles to proper heading tags (h2, h3, etc.).
- Ensure paragraphs are properly wrapped in <p> tags.
- Convert bullet points to proper <ul> and <li> tags.
- Fix any broken or malformed HTML.
- Remove unnecessary empty paragraphs or extra spacing.
- Return ONLY the HTML content — no explanations, no markdown, no code fences.

INPUT HTML:
${content}`
    };

    // Build the appropriate prompt
    let prompt = prompts[action as keyof typeof prompts];
    
    if (!prompt) {
      return NextResponse.json({ error: "Invalid action specified. Valid actions: simplify, grammar, shorter, longer, format" }, { status: 400 });
    }

    // Add context if processing selected text
    if (selectedText && context) {
      const actionDescription =
        action === 'simplify' ? 'simplify this HTML to make it clearer and easier to understand while preserving the key information' :
        action === 'grammar' ? 'fix any spelling and grammar issues in this HTML and ensure it uses proper UK English conventions' :
        action === 'shorter' ? 'make this HTML content more concise while keeping all essential information and main points' :
        action === 'longer' ? 'expand this HTML content with more details, examples and explanations that enhance it without changing its core message' :
        action === 'format' ? 'improve the HTML structure and formatting while keeping the content exactly the same' : 'modify';

      prompt = `You are helping edit a document. Here's the context of the full document for reference:

FULL DOCUMENT CONTEXT:
${context}

Now, please ${actionDescription} for ONLY this selected HTML portion:

SELECTED HTML TO MODIFY:
${selectedText}

CRITICAL RULES:
- The selected content is HTML. Your output MUST also be valid HTML.
- Preserve ALL HTML tags and formatting (bold, italic, lists, headings, links, etc.).
- Do NOT convert HTML to plain text or Markdown.
- Do NOT add \`\`\`html code fences or any wrapping.
- Return ONLY the modified HTML fragment — not the full document.
- Use UK English.`;
    }

    // Use the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const result = await model.generateContent(prompt);
    const response = result.response;
    let enhancedContent = response.text();

    // Clean up the response - remove markdown code blocks if the model wraps them
    enhancedContent = enhancedContent
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    return NextResponse.json({ 
      enhancedContent: enhancedContent.trim(),
      originalContent: selectedText || content,
      action 
    });

  } catch (error: any) {
    console.error("Editor AI Enhancement Error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to enhance content with AI." 
    }, { status: 500 });
  }
} 
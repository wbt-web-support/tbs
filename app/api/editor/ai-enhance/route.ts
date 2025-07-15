import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Ensure the API key is available
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not set in the environment variables.");
}
 
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  try {
    const { content, action, selectedText, context } = await req.json();

    if (!content || !action) {
      return NextResponse.json({ error: "Content and action are required." }, { status: 400 });
    }

    // Define prompts for each action
    const prompts = {
      simplify: `You are an AI editor. Please simplify the following HTML content while keeping the core meaning intact. Make it easier to understand and more concise. and make sure to always use UK English.

IMPORTANT: Return ONLY the clean HTML content without any markdown formatting, code blocks, or backticks. Do not wrap your response in \`\`\`html or any other formatting.

${content}`,

      grammar: `You are an AI editor. Please fix any spelling and grammar errors in the following HTML content. Maintain the original tone and meaning, but correct any mistakes and make sure to always use UK English.

IMPORTANT: Return ONLY the clean HTML content without any markdown formatting, code blocks, or backticks. Do not wrap your response in \`\`\`html or any other formatting.

${content}`,

      shorter: `You are an AI editor. Please make the following HTML content shorter while preserving all the key information and main points. Be concise but comprehensive and make sure to always use UK English.

IMPORTANT: Return ONLY the clean HTML content without any markdown formatting, code blocks, or backticks. Do not wrap your response in \`\`\`html or any other formatting.

${content}`,

      longer: `You are an AI editor. Please expand the following HTML content with more detail, examples, and explanations. Add valuable information that enhances the content without changing the core message and make sure to always use UK English.

IMPORTANT: Return ONLY the clean HTML content without any markdown formatting, code blocks, or backticks. Do not wrap your response in \`\`\`html or any other formatting.

${content}`
    };

    // Build the appropriate prompt
    let prompt = prompts[action as keyof typeof prompts];
    
    if (!prompt) {
      return NextResponse.json({ error: "Invalid action specified. Valid actions: simplify, grammar, shorter, longer" }, { status: 400 });
    }

    // Add context if processing selected text
    if (selectedText && context) {
      prompt = `You are helping edit a document. Here's the context of the full document:

FULL DOCUMENT CONTEXT:
${context}

Now, please ${action === 'simplify' ? 'simplify' : action === 'grammar' ? 'fix spelling and grammar in' : action === 'shorter' ? 'make shorter' : 'expand'} this specific selected portion:

SELECTED TEXT TO MODIFY:
${selectedText}

Return only the modified version of the selected text in the same format (HTML if HTML, plain text if plain text). Do not include the full document context in your response.`;
    }

    // Use the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite-001" });

    const result = await model.generateContent(prompt);
    const response = result.response;
    let enhancedContent = response.text();

    // Clean up the response - remove markdown code blocks and other unwanted formatting
    enhancedContent = enhancedContent
      .replace(/```html\s*/gi, '') // Remove ```html
      .replace(/```\s*/g, '') // Remove closing ```
      .replace(/^html\s*/gi, '') // Remove leading 'html' text
      .trim();

    // Additional cleanup for common AI formatting issues
    if (enhancedContent.startsWith('<') && enhancedContent.endsWith('>')) {
      // Looks like clean HTML, keep as is
    } else if (enhancedContent.includes('<') && enhancedContent.includes('>')) {
      // Contains HTML but might have extra text, try to extract just the HTML
      const htmlMatch = enhancedContent.match(/<[\s\S]*>/);
      if (htmlMatch) {
        enhancedContent = htmlMatch[0];
      }
    }

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
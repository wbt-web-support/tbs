import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    // Read request body ONCE
    const { prompt, maxTokens = 20, temperature = 0.3 } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Prepare Gemini model
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    });

    // Call Gemini LLM
    const result = await model.generateContent(prompt);

    // Read response body ONCE
    const content = await result.response.text();

    // Return the generated title
    return NextResponse.json({
      content: content.trim(),
      success: true
    });

  } catch (error) {
    // Log and return error
    console.error('Gemini content generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate content',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

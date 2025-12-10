import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { competitorUrl, businessContext } = await request.json();

    if (!competitorUrl) {
      return NextResponse.json({ error: 'Competitor URL is required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY environment variable is not set' }, { status: 500 });
    }

    // Initialize Gemini client
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Create a focused prompt for competitor analysis
    let prompt = `Analyze this competitor website: ${competitorUrl}

Please provide a concise analysis based on your training data and knowledge about this company. Focus on these 6 key areas:

1. Company Overview - Brief company description and what they do
2. Main Products/Services - What they offer to customers
3. Target Market - Who their customers are
4. Key Strengths - What they do well
5. Competitive Position - How they stand out in the market
6. Business Model - How they operate and make money

Keep each section brief (1-2 sentences maximum). Use clean, simple text without any formatting, asterisks, or special characters. If you don't have specific information about this company, provide a general analysis based on the industry type.`;

    // Include business context if available to provide more relevant analysis
    if (businessContext && Object.keys(businessContext).length > 0) {
      prompt += `\n\nBUSINESS CONTEXT - Use this information to provide more relevant competitor analysis:\n`;
      for (const [key, value] of Object.entries(businessContext)) {
        if (value && typeof value === 'string' && value.trim() !== '') {
          prompt += `- ${key}: ${value}\n`;
        }
      }
      prompt += `\n\nIMPORTANT: Use this business context to understand the user's business and provide competitor analysis that's relevant to their specific situation. Focus on how this competitor relates to their business model, target market, and competitive landscape.`;
    }

    // Ensure UK English is used
    prompt += `\n\nLANGUAGE REQUIREMENT: Please write all responses in UK English spelling and terminology (e.g., "organisation" not "organization", "colour" not "color", "centre" not "center", "labour" not "labor").`;

    // Make the request to Gemini
    const model = ai.getGenerativeModel({ 
      model: "gemini-2.5-flash-lite"
    });

    // Note: Google Search grounding is not yet available in the current @google/generative-ai package
    // This will use the model's training data instead. For real-time website analysis,
    // you would need to implement web scraping separately or use a different service.

    const response = await model.generateContent(prompt);
    
    if (!response.response) {
      throw new Error('No response from Gemini API');
    }
    
    const scrapedData = response.response.text();

    // Clean up any formatting from the response
    const cleanText = (text: string) => {
      return text
        .replace(/\*\*/g, '')  // Remove bold markers
        .replace(/\*/g, '')    // Remove italic markers
        .replace(/#{1,6}\s/g, '') // Remove headers
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/`([^`]+)`/g, '$1') // Remove inline code
        .replace(/\n\s*\n/g, '\n') // Remove extra blank lines
        .trim();
    };

    const cleanedScrapedData = cleanText(scrapedData);

    // Extract structured information using a follow-up prompt
    const structuredPrompt = `Based on this competitor analysis, please extract and format the key information in a structured way:

${cleanedScrapedData}

Please return the information in this exact JSON format with clean, simple text (no formatting, asterisks, or special characters). Use UK English spelling and terminology:

{
  "companyName": "Company Name",
  "companyOverview": "Brief company description and what they do",
  "mainProducts": "What they offer to customers",
  "targetMarket": "Who their customers are",
  "keyStrengths": "What they do well",
  "competitivePosition": "How they stand out in the market",
  "businessModel": "How they operate and make money",
  "websiteUrl": "${competitorUrl}",
  "scrapedAt": "${new Date().toISOString()}",
  "rawAnalysis": "${cleanedScrapedData.replace(/"/g, '\\"')}"
}`;

    const structuredResponse = await model.generateContent(structuredPrompt);
    
    if (!structuredResponse.response) {
      throw new Error('No response from Gemini API for structured data');
    }

    let structuredData;
    try {
      // Try to parse the structured response
      const structuredText = structuredResponse.response.text();
      const jsonMatch = structuredText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        structuredData = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback to manual parsing if JSON extraction fails
        structuredData = {
          companyName: "Unknown",
          companyOverview: "Information not available",
          mainProducts: "Information not available",
          targetMarket: "Information not available",
          keyStrengths: "Information not available",
          competitivePosition: "Information not available",
          businessModel: "Information not available",
          websiteUrl: competitorUrl,
          scrapedAt: new Date().toISOString(),
          rawAnalysis: cleanedScrapedData
        };
      }
    } catch (parseError) {
      console.error('Error parsing structured response:', parseError);
      // Fallback to basic structure
      structuredData = {
        companyName: "Unknown",
        companyOverview: "Information not available",
        mainProducts: "Information not available",
        targetMarket: "Information not available",
        keyStrengths: "Information not available",
        competitivePosition: "Information not available",
        businessModel: "Information not available",
        websiteUrl: competitorUrl,
        scrapedAt: new Date().toISOString(),
        rawAnalysis: scrapedData
      };
    }

    return NextResponse.json({
      success: true,
      data: structuredData,
      rawAnalysis: cleanedScrapedData,
      note: "Analysis based on Gemini's training data. For real-time website content, consider implementing web scraping."
    });

  } catch (error) {
    console.error('Error scraping competitor website:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scrape competitor website',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

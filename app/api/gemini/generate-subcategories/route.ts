import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getTeamId } from "@/utils/supabase/teams";

const MODEL_NAME = "gemini-2.5-flash-lite";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

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
    return "No company onboarding data available.";
  }

  const data = onboardingData.onboarding_data;
  let context = "## 🏢 COMPANY ONBOARDING CONTEXT\n\n";

  // Basic company info
  if (data.company_name) context += `- Company Name: ${data.company_name}\n`;
  if (data.industry) context += `- Industry: ${data.industry}\n`;
  if (data.company_size) context += `- Company Size: ${data.company_size}\n`;
  if (data.revenue) context += `- Revenue: ${data.revenue}\n`;
  if (data.goals) context += `- Goals: ${data.goals}\n`;

  // Additional context from onboarding_data
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
    const { service_id, service_name, business_details } = body;

    if (!service_id || !service_name) {
      return NextResponse.json(
        { error: "Service ID and service name are required" },
        { status: 400 }
      );
    }

    if (!business_details || !business_details.trim()) {
      return NextResponse.json(
        { error: "Business details are required" },
        { status: 400 }
      );
    }

    const teamId = await getTeamId(supabase, user.id);
    if (!teamId) {
      return NextResponse.json({ error: "Team ID not found" }, { status: 404 });
    }

    // Fetch company onboarding data
    const onboardingData = await getCompanyOnboardingData(user.id);
    const companyContext = formatCompanyContext(onboardingData);

    // Build the AI prompt
    const prompt = `You are helping generate specific service subcategories for growth and fulfillment engines.

${companyContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🎯 SERVICE: ${service_name.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📝 BUSINESS DETAILS PROVIDED:
${business_details}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ✅ REQUIREMENTS FOR SUBCATEGORIES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Generate EXACTLY 3 specific subcategories that are ACTIONABLE and MACHINE-READY
2. Each subcategory must be specific enough to create targeted growth AND fulfilment strategies
3. Consider the company's specialities, focus areas, and business details provided above
4. Each subcategory should represent a distinct service offering

## 📋 EXAMPLES FOR "ELECTRICAL" SERVICE:

✅ GOOD (Specific & Actionable):
- "Safety Certificate Inspections"
- "Residential Rewiring Services"
- "Commercial New Installations"
- "Emergency Electrical Repairs"
- "Smart Home Electrical Integration"

❌ BAD (Too Generic):
- "Electrical Work"
- "General Services"
- "Electrical Repairs"
- "Installations"

## 🎯 CRITERIA FOR GOOD SUBCATEGORIES:

1. **Specificity**: Each subcategory should be narrow enough that you can create distinct growth and fulfillment strategies
2. **Actionability**: The subcategory name should clearly indicate what service is being offered
3. **Distinctiveness**: Each subcategory should be different enough from others to warrant separate strategies
4. **Relevance**: Based on the business details provided, focus on what this company actually does

## 📤 OUTPUT FORMAT:

Return a JSON array with this exact structure:
[
  {
    "subcategory_name": "Specific Subcategory Name",
    "description": "Brief description of what this subcategory entails and why it's distinct"
  },
  ...
]

Generate subcategories now based on the service "${service_name}" and the business details provided.`;

    // Generate subcategories using Gemini
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse the JSON response
    let subcategories;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        subcategories = JSON.parse(jsonMatch[0]);
      } else {
        subcategories = JSON.parse(text);
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      console.error("AI Response:", text);
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    // Validate the response structure
    if (!Array.isArray(subcategories) || subcategories.length === 0) {
      return NextResponse.json(
        { error: "Invalid machine format from AI" },
        { status: 500 }
      );
    }

    // Limit to maximum 3 machines
    if (subcategories.length > 3) {
      subcategories = subcategories.slice(0, 3);
    }

    // Validate each machine
    for (const subcat of subcategories) {
      if (!subcat.subcategory_name || typeof subcat.subcategory_name !== 'string') {
        return NextResponse.json(
          { error: "Invalid machine structure: missing machine name" },
          { status: 500 }
        );
      }
    }

    // Save subcategories to database
    const subcategoriesToInsert = subcategories.map((subcat: any) => ({
      team_id: teamId,
      service_id: service_id,
      subcategory_name: subcat.subcategory_name.trim(),
      description: subcat.description || null,
      ai_generated: true
    }));

    const { data: insertedSubcategories, error: insertError } = await supabase
      .from("service_subcategories")
      .insert(subcategoriesToInsert)
      .select(`
        id,
        team_id,
        service_id,
        subcategory_name,
        description,
        ai_generated,
        created_at,
        updated_at,
        global_services:service_id (
          id,
          service_name,
          description,
          category
        )
      `);

    if (insertError) {
      console.error("Error saving subcategories:", insertError);
      // If there's a unique constraint violation, some subcategories might already exist
      // Return the ones that were successfully created
      if (insertError.code === '23505') {
        // Fetch existing subcategories for this service
        const { data: existingSubcategories } = await supabase
          .from("service_subcategories")
          .select(`
            id,
            team_id,
            service_id,
            subcategory_name,
            description,
            ai_generated,
            created_at,
            updated_at,
            global_services:service_id (
              id,
              service_name,
              description,
              category
            )
          `)
          .eq("team_id", teamId)
          .eq("service_id", service_id);

        return NextResponse.json({
          success: true,
          message: "Some machines already exist. Returning existing machines.",
          subcategories: existingSubcategories || []
        });
      }
      return NextResponse.json(
        { error: "Failed to save machines" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Created ${insertedSubcategories.length} machine${insertedSubcategories.length !== 1 ? 's' : ''}`,
      subcategories: insertedSubcategories || []
    });
  } catch (error: any) {
    console.error("Error in POST /api/gemini/generate-subcategories:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

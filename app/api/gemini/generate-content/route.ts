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
    const { currentFormValues, questionName, questionLabel, categoryTitle, customPrompt, existingContent, action } = await req.json();

    // Build the prompt for the AI
    let prompt = `You are an AI assistant helping a business owner fill out an onboarding form for a trades business school program.
    The current question is "${questionLabel}" in the "${categoryTitle}" section. Keep the answer concise, relevant, and in plain text without any markdown. but you can add line breaks for readability. and one more important thing only respond in UK English.`;

    if (customPrompt) {
      prompt += `\nThe user has provided the following custom instructions: "${customPrompt}".`;
    }

    // Include previous answers as context
    if (Object.keys(currentFormValues).length > 0) {
      prompt += `\nHere are the user's previous answers from the form for context:\n`;
      for (const key in currentFormValues) {
        if (currentFormValues[key] && key !== questionName) { // Include only answered fields, exclude the current question
          // Find the label for the key to make the context more readable
          const question = questions.find(q => q.name === key);
          const label = question ? question.label : key;
          prompt += `- ${label}: ${currentFormValues[key]}\n`;
        }
      }
    }

    if (action === 'generate') {
      prompt += `\nPlease generate a concise and relevant answer for the question "${questionLabel}" based on the provided context and custom instructions. dont inlude any ** for markdown or anything just a simple linebreak, : , list , numbering and other noraml stuff is good.`;
    } else if (action === 'improve') {
      prompt += `\nThe current answer for this question is: "${existingContent}".`;
      prompt += `\nPlease improve this answer based on the provided context and custom instructions. Output only the improved plain text answer.`;
    } else {
       return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });
    }


    // Use the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite-001" });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const generatedContent = response.text();

    return NextResponse.json({ generatedContent });

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate content from AI." }, { status: 500 });
  }
}

// Define questions array here or import it if it's in a shared file
// For now, copying from onboarding.client.tsx for simplicity
const questions = [
  // Company Information
  {
    name: 'company_name_official_registered',
    label: "What is your business's full legal name as registered?",
    type: 'input',
    placeholder: "Enter your business's legal name",
    required: true,
  },
  {
    name: 'list_of_business_owners_full_names',
    label: "List all business owners with their full names and roles.",
    type: 'input',
    placeholder: "e.g. Jane Doe (CEO), John Smith (COO)",
    required: true,
  },
  {
    name: 'primary_company_email_address',
    label: "What is the primary business email address for official communication?",
    type: 'input',
    inputType: 'email',
    placeholder: "Enter business email",
    required: true,
  },
  {
    name: 'primary_company_phone_number',
    label: "What is the main business phone number for client or partner contact?",
    type: 'input',
    placeholder: "Enter business phone number",
    required: true,
  },
  {
    name: 'main_office_physical_address_full',
    label: "What is the full address of your business's main office or headquarters?",
    type: 'textarea',
    placeholder: "Enter full business address",
    required: true,
  },
  {
    name: 'business_founding_date_iso',
    label: "What is the official founding date of the business? (YYYY-MM-DD)",
    type: 'input',
    inputType: 'date',
    required: true,
  },
  {
    name: 'company_origin_story_and_founder_motivation',
    label: "Describe the origin story of your company and the motivation behind starting it.",
    type: 'textarea',
    placeholder: "Share your company's origin story and motivation",
    required: true,
  },
  {
    name: 'main_competitors_list_and_reasons',
    label: "Who are your main competitors and why did you select them as competitors? (List 3-5 with reasons)",
    type: 'textarea',
    placeholder: "List competitors and reasons",
    required: true,
  },
  {
    name: 'current_employees_and_roles_responsibilities',
    label: "List all current employees, their roles, and their main responsibilities.",
    type: 'textarea',
    placeholder: "List employees, roles, and responsibilities",
    required: true,
  },
  {
    name: 'last_full_year_annual_revenue_amount',
    label: "What was your business's annual revenue for the last fiscal year?",
    type: 'input',
    placeholder: "Enter annual revenue",
    required: true,
  },
  {
    name: 'current_profit_margin_percentage',
    label: "What is your business's current profit margin (as a percentage)?",
    type: 'input',
    placeholder: "Enter profit margin (%)",
    required: true,
  },
 {
    name: 'company_long_term_vision_statement',
    label: "Describe your business's long-term vision and the impact you hope to achieve.",
    type: 'textarea',
    placeholder: "Describe vision and impact",
    required: true,
  },

  // War Machine Vision
  { name: 'ultimate_long_term_goal_for_business_owner', label: 'What is your ultimate long-term goal? (e.g., financial freedom, a specific revenue target, a legacy business, an exit strategy, etc.)', type: 'textarea', required: false },
  { name: 'definition_of_success_in_5_10_20_years', label: 'What does success look like for you in 5, 10, and 20 years?', type: 'textarea', required: false },
  { name: 'additional_income_streams_or_investments_needed', label: "If your current business isn't enough to reach this goal, what other income streams, investments, or businesses might be needed?", type: 'textarea', required: false },
  { name: 'focus_on_single_business_or_multiple_long_term', label: 'Do you see yourself focusing on one business long-term, or do you want to build a group of companies?', type: 'textarea', required: false },
  { name: 'personal_skills_knowledge_networks_to_develop', label: 'What personal skills, knowledge, or networks do you think you would need to develop to build your War Machine successfully?', type: 'textarea', required: false },

  // Products and Services
  { name: 'business_overview_for_potential_investor', label: 'Please give a short overview of what your business does as if you were explaining it to a potential investor.', type: 'textarea', required: false },
  { name: 'description_of_target_customers_for_investor', label: 'Please give a short overview of who your business serves as if you were explaining it to a potential investor.', type: 'textarea', required: false },
  { name: 'list_of_things_going_right_in_business', label: 'Please list all the things that you feel are going right in the business right now.', type: 'textarea', required: false },
  { name: 'list_of_things_going_wrong_in_business', label: 'Please list all the things that you feel are going wrong in the business right now.', type: 'textarea', required: false },
  { name: 'list_of_things_missing_in_business', label: 'Please list all the things that you feel are missing in the business right now.', type: 'textarea', required: false },
  { name: 'list_of_things_confusing_in_business', label: 'Please list all the things that you feel are confusing in the business right now.', type: 'textarea', required: false },
  { name: 'plans_to_expand_services_or_locations', label: 'Do you have plans to expand into new services or locations?', type: 'textarea', required: false },

  // Sales & Customer Journey
  { name: 'detailed_sales_process_from_first_contact_to_close', label: 'What does your sales process look like? (From first contact to closed deal - please be as detailed as possible)', type: 'textarea', required: false },
  { name: 'structured_follow_up_process_for_unconverted_leads', label: "Do you have a structured follow-up process for leads that don't convert immediately?", type: 'textarea', required: false },
  { name: 'customer_experience_and_fulfillment_process', label: 'How do you ensure customers have a great experience with your business? (From closed deal to completing the job - please be as detailed as possible as to the fulfilment process)', type: 'textarea', required: false },

  // Operations & Systems
  { name: 'documented_systems_or_sops_links', label: 'Do you currently have documented systems or SOPs in place? (If so, please share link to them below so we can review before your 3-1 kick-off meeting).', type: 'textarea', required: false },
  { name: 'software_and_tools_used_for_operations', label: 'What software or tools are you currently using for operations? (E.g., CRM, job management, accounting, etc.)', type: 'textarea', required: false },
  { name: 'team_structure_and_admin_sales_marketing_roles', label: 'Do you have a team that handles admin, sales, or marketing, or are you doing most of it yourself?', type: 'textarea', required: false },
  { name: 'regular_team_meetings_frequency_attendees_agenda', label: 'Do you currently hold regular team meetings? If so, how often do they happen, who attends, and do you follow a set agenda?', type: 'textarea', required: false },
  { name: 'kpi_scorecards_metrics_tracked_and_review_frequency', label: 'Do you currently use scorecards or track key performance indicators (KPIs) for your team members? If so, what metrics do you monitor, and how frequently do you review them? If not, what challenges have prevented you from implementing a tracking system?', type: 'textarea', required: false },
  { name: 'biggest_current_operational_headache', label: 'What is your biggest operational headache right now?', type: 'textarea', required: false },

  // Final Section
  { name: 'most_exciting_aspect_of_bootcamp_for_you', label: 'What are you most excited about in this Bootcamp?', type: 'textarea', required: false },
  { name: 'specific_expectations_or_requests_for_bootcamp', label: 'Do you have any specific expectations or requests for us?', type: 'textarea', required: false },
  { name: 'additional_comments_or_items_for_attention', label: 'Please list any additional comments or items that you would like to bring to our attention before we get started.', type: 'textarea', required: false },
];

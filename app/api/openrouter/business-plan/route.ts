import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

const MAX_EXTRACT_LENGTH = 80000;
const AI_CONFIG_KEY_BUSINESS_PLAN = "openrouter_business_plan_model";
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o";

/** Extract text from an uploaded document URL (PDF or DOCX). Used for business plan context. */
async function extractDocumentContent(documentUrl: string): Promise<string | null> {
  try {
    const res = await fetch(documentUrl);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const urlLower = documentUrl.toLowerCase();
    if (urlLower.includes(".pdf") || (res.headers.get("content-type") || "").includes("pdf")) {
      const data = await pdfParse(buffer);
      let text = (data?.text || "").trim();
      if (text.length > MAX_EXTRACT_LENGTH) text = text.substring(0, MAX_EXTRACT_LENGTH) + "\n... [Content truncated]";
      return text || null;
    }
    if (urlLower.includes(".docx") || (res.headers.get("content-type") || "").includes("word")) {
      const result = await mammoth.extractRawText({ buffer });
      let text = (result?.value || "").trim();
      if (text.length > MAX_EXTRACT_LENGTH) text = text.substring(0, MAX_EXTRACT_LENGTH) + "\n... [Content truncated]";
      return text || null;
    }
    if (urlLower.includes(".txt") || (res.headers.get("content-type") || "").includes("text/plain")) {
      let text = buffer.toString("utf-8").trim();
      if (text.length > MAX_EXTRACT_LENGTH) text = text.substring(0, MAX_EXTRACT_LENGTH) + "\n... [Content truncated]";
      return text || null;
    }
    return null;
  } catch (e) {
    console.error("Business plan document extraction error:", e);
    return null;
  }
}

async function getOpenRouterModel(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_config")
    .select("value")
    .eq("key", AI_CONFIG_KEY_BUSINESS_PLAN)
    .single();
  if (!error && data?.value?.trim()) return data.value.trim();
  return process.env.OPENROUTER_DEFAULT_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
}

// Helper function to get user ID from request
async function getUserId(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id;
  } catch (error) {
    console.error("Error getting user session:", error);
    return null;
  }
}

async function getTeamId(userId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No authenticated user");
    const { data: businessInfo, error } = await supabase
      .from("business_info")
      .select("team_id")
      .eq("user_id", userId)
      .single();
    if (error) throw error;
    return businessInfo?.team_id;
  } catch (error) {
    console.error("Error getting team ID:", error);
    return null;
  }
}

async function getCompanyData(userId: string, teamId: string) {
  try {
    const supabase = await createClient();
    const { data: businessInfo, error: businessError } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (businessError && businessError.code !== "PGRST116") {
      console.error("Error fetching business info:", businessError);
    }
    const { data: teamMembers, error: teamError } = await supabase
      .from('business_info')
      .select('*')
      .eq('team_id', teamId)
      .order('full_name', { ascending: true });
    if (teamError) {
      console.error('Error fetching team members:', teamError);
    }
    const dataPromises = [
      supabase.from('company_onboarding').select('*').eq('user_id', userId),
      supabase.from('machines').select('*').eq('user_id', teamId),
      supabase.from('meeting_rhythm_planner').select('*').eq('user_id', userId),
      supabase.from('playbooks').select('*').eq('user_id', userId),
      supabase.from('quarterly_sprint_canvas').select('*').eq('user_id', userId),
      supabase.from('key_initiatives').select('*').eq('team_id', teamId),
      supabase.from('departments').select('*').eq('team_id', teamId),
      supabase.from('quarter_planning').select('*').eq('team_id', teamId),
    ];
    const results = await Promise.all(dataPromises);
    return {
      businessInfo: businessInfo || null,
      teamMembers: teamMembers || [],
      companyOnboarding: results[0].data || [],
      machines: results[1].data || [],
      meetingRhythmPlanner: results[2].data || [],
      playbooks: results[3].data || [],
      quarterlySprintCanvas: results[4].data || [],
      keyInitiatives: results[5].data || [],
      departments: results[6].data || [],
      quarterPlanning: results[7].data || [],
    };
  } catch (error) {
    console.error("Error fetching company data:", error);
    return null;
  }
}

function formatCompanyContext(companyData: any) {
  if (!companyData) return '';
  const parts: string[] = ['📊 COMPANY DATA CONTEXT 📊\n'];
  if (companyData.businessInfo) {
    const info = companyData.businessInfo;
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 👤 COMPANY INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Company Details:
- Business Name: ${info.business_name || 'Unknown'}
- Full Name: ${info.full_name || 'Unknown'}
- Email: ${info.email || 'Unknown'}
- Phone: ${info.phone_number || 'Unknown'}
- Role: ${info.role || 'user'}
- Job Title: ${info.job_title || 'Not specified'}
- Department: ${info.department || 'Not specified'}
- Manager: ${info.manager || 'Not specified'}
- Critical Accountabilities: ${info.critical_accountabilities ? JSON.stringify(info.critical_accountabilities) : 'None'}`);
  }
  if (companyData.teamMembers && companyData.teamMembers.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 👥 TEAM MEMBERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    companyData.teamMembers.forEach((member: any, index: number) => {
      parts.push(`
👤 Team Member #${index + 1}:
- Full Name: ${member.full_name}
- Job Title: ${member.job_title || 'Not specified'}
- Department: ${member.department || 'Not specified'}
- Role: ${member.role}
- Critical Accountabilities: ${member.critical_accountabilities ? JSON.stringify(member.critical_accountabilities) : 'None'}`);
    });
  }
  if (companyData.machines && companyData.machines.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⚙️ EXISTING MACHINES (GROWTH & FULFILLMENT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use this context to align the business plan with how the business attracts and delivers value.`);
    companyData.machines.forEach((machine: any, index: number) => {
      parts.push(`
🔧 Machine #${index + 1} — ${machine.enginetype}:
- Name: ${machine.enginename || 'No name'}
- Type: ${machine.enginetype || 'Unknown'}
- Description: ${machine.description || 'No description'}
- Triggering Events: ${machine.triggeringevents ? JSON.stringify(machine.triggeringevents) : 'None'}
- Ending Events: ${machine.endingevent ? JSON.stringify(machine.endingevent) : 'None'}
- Actions/Activities: ${machine.actionsactivities ? JSON.stringify(machine.actionsactivities) : 'None'}`);
      if (machine.answers && typeof machine.answers === 'object' && Object.keys(machine.answers).length > 0) {
        parts.push(`\n  User answers from ${machine.enginetype} machine onboarding:`);
        const qList = machine.questions?.questions;
        Object.entries(machine.answers).forEach(([key, value]: [string, any]) => {
          if (value == null || String(value).trim() === '') return;
          const label = qList?.find((q: any) => q.id === key)?.question_text || key;
          const display = Array.isArray(value) ? value.join(', ') : String(value);
          parts.push(`  - ${label}: ${display}`);
        });
      }
    });
  }
  if (companyData.companyOnboarding && companyData.companyOnboarding.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🏢 COMPANY ONBOARDING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    companyData.companyOnboarding.forEach((onboarding: any, index: number) => {
      const data = onboarding.onboarding_data || {};
      if (onboarding.onboarding_data && typeof onboarding.onboarding_data === "object") {
        parts.push(`
📝 Onboarding #${index + 1} (full onboarding data):
- Company Name: ${data.company_name_official_registered ?? data.company_name ?? "Not specified"}
- Business Overview: ${data.business_overview_for_potential_investor ?? "Not specified"}
- Target Customers: ${data.description_of_target_customers_for_investor ?? "Not specified"}
- Location: ${data.main_office_physical_address_full ?? "Not specified"}
- Founding Date: ${data.business_founding_date_iso ?? "Not specified"}
- Company Origin Story: ${data.company_origin_story_and_founder_motivation ?? "Not specified"}
- Revenue: ${data.last_full_year_annual_revenue_amount ?? onboarding.revenue ?? "Not specified"}
- Profit Margin: ${data.current_profit_margin_percentage ?? "Not specified"}
- Company Vision: ${data.company_long_term_vision_statement ?? "Not specified"}
- Sales Process: ${data.detailed_sales_process_from_first_contact_to_close ?? "Not specified"}
- Customer Experience: ${data.customer_experience_and_fulfillment_process ?? "Not specified"}
- Team Structure: ${data.team_structure_and_admin_sales_marketing_roles ?? "Not specified"}
- Regular Meetings: ${data.regular_team_meetings_frequency_attendees_agenda ?? "Not specified"}
- KPI Metrics: ${data.kpi_scorecards_metrics_tracked_and_review_frequency ?? "Not specified"}
- Biggest Operational Headache: ${data.biggest_current_operational_headache ?? "Not specified"}`);
      } else {
        parts.push(`
📝 Onboarding #${index + 1}:
- Company Name: ${onboarding.company_name || "Unknown"}
- Industry: ${onboarding.industry || "Unknown"}
- Company Size: ${onboarding.company_size || "Unknown"}
- Revenue: ${onboarding.revenue || "Unknown"}
- Goals: ${onboarding.goals || "None"}`);
      }
    });
  }
  if (companyData.keyInitiatives && companyData.keyInitiatives.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🎯 KEY INITIATIVES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    companyData.keyInitiatives.forEach((initiative: any, index: number) => {
      parts.push(`
🎯 Initiative #${index + 1}:
- Name: ${initiative.name || 'No name'}
- Description: ${initiative.description || 'No description'}
- Status: ${initiative.status || 'Unknown'}
- Priority: ${initiative.priority || 'Unknown'}`);
    });
  }
  if (companyData.departments && companyData.departments.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🏢 DEPARTMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    companyData.departments.forEach((dept: any, index: number) => {
      parts.push(`
🏢 Department #${index + 1}:
- Name: ${dept.name || 'No name'}
- Description: ${dept.description || 'No description'}`);
    });
  }
  if (companyData.quarterPlanning && companyData.quarterPlanning.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📅 QUARTER PLANNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    companyData.quarterPlanning.forEach((plan: any, index: number) => {
      parts.push(`
📅 Quarter Plan #${index + 1}:
- Quarter: ${plan.quarter || 'Unknown'}
- Year: ${plan.year || 'Unknown'}
- Goals: ${plan.goals || 'None'}
- Objectives: ${plan.objectives || 'None'}`);
    });
  }
  return parts.join('\n');
}

async function saveGeneratedContent(userId: string, teamId: string, generatedData: any) {
  try {
    const supabase = await createClient();
    const { data: existingPlan, error: fetchError } = await supabase
      .from("battle_plan")
      .select("*")
      .eq("user_id", teamId)
      .single();
    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }
    const planData = {
      user_id: teamId,
      missionstatement: generatedData.missionstatement,
      visionstatement: generatedData.visionstatement,
      corevalues: generatedData.corevalues,
      strategicanchors: generatedData.strategicanchors,
      purposewhy: generatedData.purposewhy,
      fiveyeartarget: generatedData.fiveyeartarget,
      oneyeartarget: { targets: generatedData.oneyeartarget },
      business_plan_content: generatedData.business_plan_document_html,
    };
    let result;
    if (existingPlan) {
      result = await supabase
        .from("battle_plan")
        .update(planData)
        .eq("id", existingPlan.id)
        .select("*")
        .single();
    } else {
      result = await supabase
        .from("battle_plan")
        .insert(planData)
        .select("*")
        .single();
    }
    if (result.error) throw result.error;
    return result.data;
  } catch (error) {
    console.error("Error saving generated content:", error);
    throw error;
  }
}

function parseBusinessPlanResponse(cleanedText: string): any {
  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");
  const raw = jsonMatch[0];
  try {
    return JSON.parse(raw);
  } catch {
    const key = '"business_plan_document_html"';
    const idx = raw.indexOf(key);
    if (idx === -1) throw new Error("business_plan_document_html key not found");
    const valueStart = raw.indexOf('"', idx + key.length);
    if (valueStart === -1) throw new Error("business_plan_document_html value start not found");
    let end = valueStart + 1;
    let htmlValue = "";
    while (end < raw.length) {
      const ch = raw[end];
      if (ch === "\\") {
        end += 1;
        if (end < raw.length) {
          if (raw[end] === '"') htmlValue += '"';
          else if (raw[end] === "n") htmlValue += "\n";
          else if (raw[end] === "\\") htmlValue += "\\";
        }
        end += 1;
        continue;
      }
      if (ch === '"') {
        let look = end + 1;
        while (look < raw.length && /[\s\n\r]/.test(raw[look])) look += 1;
        if (look < raw.length && (raw[look] === "}" || raw[look] === ",")) break;
        htmlValue += ch;
      } else {
        htmlValue += ch;
      }
      end += 1;
    }
    const before = raw.slice(0, valueStart + 1);
    const after = raw.slice(end);
    const repaired = before + '"__HTML_PLACEHOLDER__"' + after;
    let parsed: any;
    try {
      parsed = JSON.parse(repaired);
    } catch {
      throw new Error("Could not parse JSON even after extracting HTML");
    }
    parsed.business_plan_document_html = htmlValue;
    return parsed;
  }
}

const BUSINESS_PLAN_JSON_STRUCTURE = `
CRITICAL: You must respond with ONLY a valid JSON object. No text before or after. The response will be parsed with JSON.parse(), so every string must be valid JSON:
- Inside any string, escape double quotes as \\" (backslash-quote) and newlines as \\n.
- For business_plan_document_html use a single string with no literal newlines; use \\n for line breaks. Escape any " inside the HTML as \\".

Exact structure (keys in this order):

{
  "missionstatement": "One or two sentences.",
  "visionstatement": "One or two sentences.",
  "corevalues": [
    {"value": "First core value"},
    {"value": "Second core value"},
    {"value": "Third core value"}
  ],
  "strategicanchors": [
    {"value": "First strategic anchor"},
    {"value": "Second strategic anchor"},
    {"value": "Third strategic anchor"}
  ],
  "purposewhy": [
    {"value": "First purpose/why"},
    {"value": "Second purpose/why"},
    {"value": "Third purpose/why"}
  ],
  "oneyeartarget": [
    {"value": "First one year target", "completed": false, "deadline": "YYYY-MM-DD"},
    {"value": "Second one year target", "completed": false, "deadline": "YYYY-MM-DD"},
    {"value": "Third one year target", "completed": false, "deadline": "YYYY-MM-DD"}
  ],
  "fiveyeartarget": [
    {"value": "First five year target", "completed": false, "deadline": "YYYY-MM-DD"},
    {"value": "Second five year target", "completed": false, "deadline": "YYYY-MM-DD"},
    {"value": "Third five year target", "completed": false, "deadline": "YYYY-MM-DD"}
  ],
  "business_plan_document_html": "<h2>Company Overview</h2><p>...</p><h2>Target Market</h2>..."
}

Layout: Mission, Vision, Core values, Strategic anchors, Purpose, 1-year/5-year targets go into the JSON fields above and are shown in the Structured tab. The business_plan_document_html is the main plan document and is shown in the "Details plan info" tab.

DOCUMENT RULE (business_plan_document_html): Structure the main document exactly according to the eight sections defined in the prompt above (DOCUMENT STRUCTURE — EIGHT SECTIONS), in that order. Use plain <h2> for each section title, <h3> for subsections; no numbering in headings. Use <ul>/<li> for lists when clearer than paragraphs. Valid HTML only (<h2>, <h3>, <p>, <ul>, <li>, <strong>). Single JSON string; escape " as \\" and use \\n for newlines. No markdown.

PARAGRAPH LENGTH (critical): Keep each <p> paragraph to a maximum of 50–60 words. If a topic needs more content, split it into two or three shorter paragraphs (each still max 50–60 words) rather than one long block. This applies to every section, including Financial Targets, Growth Strategy, and all narrative text. Short paragraphs improve readability.

RULES:
- Use British English. Prefer full sentences; use bullets only where they improve clarity.
- No empty strings or null. Each array at least 3 items (targets at least 2).
- All text specific to the company. Base on company data and industry.
- Use deadline dates in YYYY-MM-DD from the date context above (1-year within 12 months, 5-year within 5 years).
- When information is missing or unknown, write "Not confirmed yet" or a short placeholder — do not use "TBC" or "To be confirmed".
`;

async function getPromptBody(promptKey: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('prompts')
    .select('prompt_text')
    .eq('prompt_key', promptKey)
    .single();
  if (error) {
    console.error('Error loading prompt body:', error);
    return null;
  }
  return data?.prompt_text || null;
}

/** Build the exact context strings sent to the LLM (for generate and for debug). */
async function buildBusinessPlanContext(
  userId: string,
  teamId: string,
  userAnswers?: Record<string, string> | null,
  questions?: { id: string; question_text?: string }[] | null
): Promise<{
  companyContext: string;
  userAnswersContext: string;
  uploadedDocumentContext: string;
  currentDateContext: string;
  companyData: any;
}> {
  const companyData = await getCompanyData(userId, teamId);
  const companyContext = formatCompanyContext(companyData);

  let uploadedDocumentContext = '';
  const documentUrl = userAnswers?.existing_business_plan_upload_url?.trim();
  if (documentUrl) {
    const extracted = await extractDocumentContent(documentUrl);
    if (extracted) {
      uploadedDocumentContext = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📄 UPLOADED EXISTING BUSINESS PLAN (EXTRACTED TEXT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use this content to align the new plan with the user's existing document. Do not copy verbatim; synthesize and refine.

${extracted}
`;
    }
  }

  let userAnswersContext = '';
  if (userAnswers && typeof userAnswers === 'object' && Object.keys(userAnswers).length > 0) {
    userAnswersContext = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n## 💬 USER RESPONSES (QUESTIONS & PASTED CONTENT)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    const labelByKey: Record<string, string> = {
      direction_focus: 'Main focus for the next 12 months',
      owner_role_shift: 'Owner role shift (less involved in)',
      strategic_constraint: 'Biggest constraint holding the business back',
      service_focus: 'Service/area to prioritise and why',
      existing_business_plan: 'Already has a business plan (yes/no)',
      existing_business_plan_upload_url: 'Uploaded plan document URL',
      existing_business_plan_upload_file_name: 'Uploaded plan file name',
      existing_business_plan_text: 'Pasted or additional business plan details',
      existing_mission: 'Already has a mission statement (yes/no)',
      existing_mission_text: 'Pasted mission statement',
      existing_core_values: 'Already has core values (yes/no)',
      existing_core_values_list: 'Pasted core values (list)',
    };
    if (questions && Array.isArray(questions)) {
      questions.forEach((q: any) => {
        const answer = userAnswers[q.id];
        if (answer != null && String(answer).trim() !== '') {
          const label = labelByKey[q.id] || q.question_text || q.id;
          userAnswersContext += `${label}:\n${String(answer).trim()}\n\n`;
        }
      });
    }
    Object.keys(userAnswers).forEach((key) => {
      if (questions?.some((q: any) => q.id === key)) return;
      const val = userAnswers[key];
      if (val == null || String(val).trim() === '') return;
      const label = labelByKey[key] || key;
      userAnswersContext += `${label}:\n${String(val).trim()}\n\n`;
    });
  }

  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(now.getFullYear() + 1);
  const oneYearDate = oneYearFromNow.toISOString().split('T')[0];
  const fiveYearsFromNow = new Date(now);
  fiveYearsFromNow.setFullYear(now.getFullYear() + 5);
  const fiveYearsDate = fiveYearsFromNow.toISOString().split('T')[0];
  const currentDateContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📅 CURRENT DATE INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Today's Date: ${currentDate}
- 1-year targets should have deadlines around: ${oneYearDate} (approximately 12 months from today)
- 5-year targets should have deadlines around: ${fiveYearsDate} (approximately 5 years from today)

IMPORTANT: Use these dates as reference points when setting deadlines for targets. You can adjust individual target deadlines slightly (within a few months) based on the specific target, but they should generally align with these timeframes.
`;

  return {
    companyContext,
    userAnswersContext,
    uploadedDocumentContext,
    currentDateContext,
    companyData,
  };
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const teamId = await getTeamId(userId);
    if (!teamId) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    const body = await req.json();
    const { action, generatedData, userAnswers, questions } = body;

    if (action === "getContext") {
      const ctx = await buildBusinessPlanContext(userId, teamId, userAnswers ?? undefined, questions ?? undefined);
      return NextResponse.json({
        companyContext: ctx.companyContext,
        userAnswersContext: ctx.userAnswersContext,
        uploadedDocumentContext: ctx.uploadedDocumentContext,
        currentDateContext: ctx.currentDateContext,
        fullContext: ctx.companyContext + ctx.userAnswersContext + ctx.uploadedDocumentContext + ctx.currentDateContext,
        companyData: ctx.companyData,
      });
    }

    if (action === "generate") {
      const apiKey = process.env.OPENROUTER_API_KEY?.trim();
      if (!apiKey) {
        return NextResponse.json(
          { error: "OPENROUTER_API_KEY is not set" },
          { status: 500 }
        );
      }

      const ctx = await buildBusinessPlanContext(userId, teamId, userAnswers, questions);
      const { companyContext, userAnswersContext, uploadedDocumentContext, currentDateContext } = ctx;

      let promptBody = await getPromptBody("business_plan");
      if (!promptBody) {
        throw new Error("Prompt body not found for business_plan");
      }
      promptBody = promptBody.replace(
        /{{companyContext}}/g,
        companyContext + userAnswersContext + uploadedDocumentContext + currentDateContext
      )
        .replace(/{{responseFormat}}/g, BUSINESS_PLAN_JSON_STRUCTURE);
      const documentOnlyReminder = `

REMINDER — Details plan document (business_plan_document_html): Follow the eight sections from the prompt above (DOCUMENT STRUCTURE — EIGHT SECTIONS) in order. Section 1 (Company Overview) includes Mission, Vision and Core Values; keep these consistent with the JSON fields. Do not add extra sections.`;
      const prompt = promptBody + documentOnlyReminder;

      const model = await getOpenRouterModel();
      const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      });
      if (!openRouterRes.ok) {
        const errText = await openRouterRes.text();
        console.error("OpenRouter error:", openRouterRes.status, errText);
        return NextResponse.json(
          { error: "OpenRouter request failed", details: errText },
          { status: 500 }
        );
      }
      const openRouterJson = await openRouterRes.json();
      const text = openRouterJson?.choices?.[0]?.message?.content ?? "";
      if (!text) {
        return NextResponse.json(
          { error: "Empty response from OpenRouter" },
          { status: 500 }
        );
      }

      let generatedData: any;
      try {
        let cleanedText = text.trim();
        cleanedText = cleanedText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
        generatedData = parseBusinessPlanResponse(cleanedText);
        if (!generatedData.missionstatement || generatedData.missionstatement.trim() === '') {
          throw new Error("Mission statement is empty or invalid");
        }
        if (!generatedData.visionstatement || generatedData.visionstatement.trim() === '') {
          throw new Error("Vision statement is empty or invalid");
        }
        if (!Array.isArray(generatedData.corevalues) || generatedData.corevalues.length === 0) {
          throw new Error("Core values array is empty or invalid");
        }
        if (!Array.isArray(generatedData.strategicanchors) || generatedData.strategicanchors.length === 0) {
          throw new Error("Strategic anchors array is empty or invalid");
        }
        if (!Array.isArray(generatedData.purposewhy) || generatedData.purposewhy.length === 0) {
          throw new Error("Purpose/why array is empty or invalid");
        }
        if (!Array.isArray(generatedData.fiveyeartarget) || generatedData.fiveyeartarget.length === 0) {
          throw new Error("Five year targets array is empty or invalid");
        }
        if (!Array.isArray(generatedData.oneyeartarget) || generatedData.oneyeartarget.length === 0) {
          throw new Error("One year targets array is empty or invalid");
        }
        if (!generatedData.business_plan_document_html || generatedData.business_plan_document_html.trim() === '') {
          throw new Error("Business plan document HTML is empty or invalid");
        }
        const toValue = (item: any): string =>
          (typeof item === "string" ? item : item?.value ?? "").trim();
        const toValueObj = (item: any) => ({ value: toValue(item) });
        generatedData.corevalues = (generatedData.corevalues as any[]).map(toValueObj).filter((o) => o.value !== "");
        generatedData.strategicanchors = (generatedData.strategicanchors as any[]).map(toValueObj).filter((o) => o.value !== "");
        generatedData.purposewhy = (generatedData.purposewhy as any[]).map(toValueObj).filter((o) => o.value !== "");
        generatedData.fiveyeartarget = (generatedData.fiveyeartarget as any[])
          .map((item: any) => ({ value: toValue(item), completed: item?.completed ?? false, deadline: item?.deadline ?? "" }))
          .filter((o) => o.value !== "");
        generatedData.oneyeartarget = (generatedData.oneyeartarget as any[])
          .map((item: any) => ({ value: toValue(item), completed: item?.completed ?? false, deadline: item?.deadline ?? "" }))
          .filter((o) => o.value !== "");
        if (generatedData.corevalues.length < 3) throw new Error("Not enough core values generated");
        if (generatedData.strategicanchors.length < 2) throw new Error("Not enough strategic anchors generated");
        if (generatedData.purposewhy.length < 2) throw new Error("Not enough purpose/why items generated");
        if (generatedData.fiveyeartarget.length < 2) throw new Error("Not enough five year targets generated");
        if (generatedData.oneyeartarget.length < 2) throw new Error("Not enough one year targets generated");
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError);
        console.error("Raw response:", text);
        return NextResponse.json({
          error: "Failed to parse AI response",
          details: parseError instanceof Error ? parseError.message : "Unknown parsing error",
          rawResponse: text,
        }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: generatedData });
    }

    if (action === "save") {
      if (!generatedData) {
        return NextResponse.json({ error: "No data provided" }, { status: 400 });
      }
      const savedData = await saveGeneratedContent(userId, teamId, generatedData);
      return NextResponse.json({ success: true, data: savedData });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in OpenRouter business plan API:", error);
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

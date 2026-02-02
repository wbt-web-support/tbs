import type { SupabaseClient } from "@supabase/supabase-js";
import { getNodeDefinition } from "@/lib/chatbot-flow/nodes";

export type UserContext = {
  userId?: string | null;
  teamId?: string | null;
};

export type ExtractionMetadata = {
  extracted_text?: string;
  file_name?: string;
  file_size?: number;
  extraction_date?: string;
  loom_metadata?: {
    thumbnailUrl?: string;
    views?: number;
    createdAt?: string;
    owner?: string;
    duration_formatted?: string;
  };
};

export type BasePromptEntry = {
  type: string;
  content: string;
  url?: string | null;
  document_url?: string | null;
  document_name?: string | null;
  extraction_metadata?: ExtractionMetadata | null;
};

export type ChatbotRow = {
  id: string;
  name: string;
  base_prompts: BasePromptEntry[];
  is_active: boolean;
  model_name: string | null;
};

export type NodeRow = {
  id: string;
  name: string;
  node_type: string;
  settings: Record<string, unknown>;
  order_index: number;
};

const SCOPE_LABELS: Record<string, string> = {
  all: "across all accounts (platform-wide)",
  team_specific: "scoped to the user's team/business only",
  user_specific: "scoped to the current user only",
};

const DATA_SOURCE_LABELS: Record<string, string> = {
  business_info: "Business info",
  business_owner_instructions: "Business owner instructions",
  company_onboarding: "Company onboarding",
  departments: "Departments",
  finance_analysis: "Finance analysis",
  google_calendar_events: "Google Calendar events",
  global_services: "Global services",
  leave_approvals: "Leave approvals",
  leave_entitlements: "Leave entitlements",
  machines: "Machines / value engines",
  performance_kpis: "Performance KPIs",
  playbook_assignments: "Playbook assignments",
  software: "Software",
  sop_data: "SOP data",
  tasks: "Tasks",
  team_leaves: "Team leaves",
  team_services: "Team services",
  battle_plan: "Battle plan",
  playbooks: "Playbooks",
};

/** Table, select columns, and which column to filter by for team vs user scope. */
const DATA_SOURCE_CONFIG: Record<
  string,
  { table: string; select: string; teamColumn?: string; userColumn?: string }
> = {
  business_info: {
    table: "business_info",
    select: "id, user_id, full_name, business_name, email, phone_number, payment_option, payment_remaining, command_hq_link, command_hq_created, gd_folder_created, meeting_scheduled, created_at, updated_at, profile_picture_url, role, google_review_link, team_id, permissions, job_title, manager, critical_accountabilities, playbooks_owned, department, manager_id, department_id, wbt_onboarding",
    teamColumn: "team_id",
    userColumn: "user_id",
  },
  business_owner_instructions: {
    table: "business_owner_instructions",
    select: "id, user_id, title, content, content_type, url, extraction_metadata, created_at, updated_at",
    userColumn: "user_id",
  },
  company_onboarding: {
    table: "company_onboarding",
    select: "id, user_id, onboarding_data, completed, competitor_data, created_at, updated_at",
    userColumn: "user_id",
  },
  departments: {
    table: "departments",
    select: "id, name, team_id, created_at, updated_at",
    teamColumn: "team_id",
  },
  finance_analysis: {
    table: "finance_analysis",
    select: "id, file_id, user_id, team_id, analysis_result, summary, status, created_at, updated_at, period_type",
    teamColumn: "team_id",
    userColumn: "user_id",
  },
  google_calendar_events: {
    table: "google_calendar_events",
    select: "id, user_id, title, description, location, start_time, end_time, all_day, status, created_at, updated_at",
    userColumn: "user_id",
  },
  global_services: {
    table: "global_services",
    select: "id, service_name, description, category, is_active, created_at, updated_at, display_order",
  },
  leave_approvals: {
    table: "leave_approvals",
    select: "id, leave_id, approver_id, action, comments, created_at",
    userColumn: "approver_id",
  },
  leave_entitlements: {
    table: "leave_entitlements",
    select: "id, team_id, total_entitlement_days, year, created_at, updated_at",
    teamColumn: "team_id",
  },
  machines: {
    table: "machines",
    select: "id, user_id, enginename, enginetype, description, triggeringevents, endingevent, actionsactivities, created_at, updated_at, figma_link, figma_embed, image_url, image_urls, welcome_completed, questions, answers, questions_completed, ai_assisted, service_name, service_id, subcategory_id, team_service_id",
    userColumn: "user_id",
  },
  performance_kpis: {
    table: "performance_kpis",
    select: "id, session_id, revenue, revenue_status, ad_spend, leads, jobs_completed, roas, roi_pounds, roi_percent, google_reviews, created_at, updated_at",
  },
  playbook_assignments: {
    table: "playbook_assignments",
    select: "id, user_id, playbook_id, assignment_type, created_at",
  },
  software: {
    table: "software",
    select: "id, software, url, description, price_monthly, department_id, team_id, pricing_period, created_at, updated_at",
    teamColumn: "team_id",
  },
  sop_data: {
    table: "sop_data",
    select: "id, user_id, title, content, version, is_current, created_at, updated_at, metadata",
    userColumn: "user_id",
  },
  tasks: {
    table: "tasks",
    select: "id, title, description, links, task_type, status, priority, start_date, due_date, assigned_to, created_by, team_id, created_at, updated_at",
    teamColumn: "team_id",
    userColumn: "assigned_to",
  },
  team_leaves: {
    table: "team_leaves",
    select: "id, user_id, leave_type, start_date, end_date, status, duration_days, description, created_at, updated_at",
    userColumn: "user_id",
  },
  team_services: {
    table: "team_services",
    select: "id, team_id, service_id, created_at, updated_at",
    teamColumn: "team_id",
  },
  battle_plan: {
    table: "battle_plan",
    select: "id, user_id, businessplanlink, missionstatement, visionstatement, purposewhy, strategicanchors, corevalues, business_plan_content, oneyeartarget, tenyeartarget, fiveyeartarget, static_questions_answers, created_at, updated_at",
    userColumn: "user_id",
  },
  playbooks: {
    table: "playbooks",
    select: "id, user_id, playbookname, description, enginetype, status, link, department_id, content, created_at, updated_at",
    userColumn: "user_id",
  },
};

const MAX_DATA_ROWS = 30;

function buildDataAccessPrompt(settings: Record<string, unknown>, withDataContext?: string): string {
  const dataSource = (settings.data_source as string) || "general data";
  const scope = (settings.scope as string) || "team_specific";
  const label = DATA_SOURCE_LABELS[dataSource] || dataSource;
  const scopeText = SCOPE_LABELS[scope] || SCOPE_LABELS.team_specific;
  let text = `[Data access] You may reference ${label}, ${scopeText}. Do not assume data from other teams or users unless scope is platform-wide.`;
  if (withDataContext?.trim()) {
    text += `\n\n[Current data for this context]\n${withDataContext.trim()}`;
  }
  return text;
}

async function fetchDataForSource(
  supabase: SupabaseClient,
  dataSource: string,
  scope: string,
  userContext: UserContext
): Promise<string> {
  const config = DATA_SOURCE_CONFIG[dataSource];
  if (!config) return "";

  const { userId, teamId } = userContext;
  const teamFilter = scope === "team_specific" && config.teamColumn && teamId;
  const userFilter = scope === "user_specific" && config.userColumn && userId;
  const teamFallbackToUser = scope === "team_specific" && !config.teamColumn && config.userColumn && userId;
  const isAllScope = scope === "all";

  let query = supabase.from(config.table).select(config.select);

  if (teamFilter && config.teamColumn) {
    query = query.eq(config.teamColumn, teamId);
  } else if (userFilter && config.userColumn) {
    query = query.eq(config.userColumn, userId);
  } else if (teamFallbackToUser) {
    query = query.eq(config.userColumn!, userId);
  } else if (!isAllScope && !teamFilter && !userFilter && !teamFallbackToUser) {
    return "";
  }
  // scope "all" (platform-wide): no filter applied; query runs with full table access

  try {
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(MAX_DATA_ROWS);
    if (error) {
      console.warn(`[chatbot-flow] fetchDataForSource ${dataSource}:`, error.message);
      return "";
    }
    if (!data?.length) return "(No rows for this context)";
    return JSON.stringify(data, null, 2);
  } catch (e) {
    console.warn(`[chatbot-flow] fetchDataForSource ${dataSource}:`, e);
    return "";
  }
}

function buildPromptFromNode(node: NodeRow, dataContext?: string): string {
  const settings = node.settings || {};
  switch (node.node_type) {
    case "data_access":
      return buildDataAccessPrompt(settings, dataContext);
    case "sub_agent": {
      const expertise = (settings.expertise_prompt as string) || "";
      return expertise.trim() ? `[Specialization]\n${expertise.trim()}` : "";
    }
    case "web_search": {
      return "[Web search] When web search is enabled for this turn, you may use Google Search to fetch current information from the web.";
    }
    case "attachments": {
      return "[Attachments] The user may attach images, PDFs, or documents to their message. Use the provided image and document content when answering.";
    }
    default:
      return "";
  }
}

/**
 * Load chatbot by id.
 */
export async function getChatbot(
  supabase: SupabaseClient,
  chatbotId: string
): Promise<ChatbotRow | null> {
  const { data, error } = await supabase
    .from("chatbots")
    .select("id, name, base_prompts, is_active, model_name")
    .eq("id", chatbotId)
    .single();
  if (error || !data) return null;
  const row = data as { base_prompts?: unknown };
  const base_prompts = Array.isArray(row.base_prompts)
    ? (row.base_prompts as BasePromptEntry[]).filter(
        (p): p is BasePromptEntry => p && typeof p.content === "string"
      )
    : [];
  return { ...data, base_prompts } as ChatbotRow;
}

type LinkRow = {
  node_key: string;
  order_index: number;
  settings: Record<string, unknown> | null;
};

/**
 * Load linked nodes for a chatbot, ordered by order_index.
 * Uses node_key (hardcoded nodes) only; node_id was removed.
 */
export async function getLinkedNodes(
  supabase: SupabaseClient,
  chatbotId: string
): Promise<NodeRow[]> {
  const { data: links, error: linksError } = await supabase
    .from("chatbot_flow_node_links")
    .select("node_key, order_index, settings")
    .eq("chatbot_id", chatbotId)
    .order("order_index", { ascending: true });

  if (linksError || !links?.length) return [];

  const linkRows = links as LinkRow[];
  const result: NodeRow[] = [];
  for (const l of linkRows) {
    const def = getNodeDefinition(l.node_key);
    if (!def) continue;
    const linkSettings = (l.settings ?? {}) as Record<string, unknown>;
    const settings = { ...def.defaultSettings, ...linkSettings };
    result.push({
      id: l.node_key,
      name: def.name,
      node_type: def.nodeType,
      settings,
      order_index: l.order_index,
    });
  }
  return result;
}

/** Present when the chatbot has a Web search node; search is enabled only when the client sends use_web_search: true. */
export type WebSearchConfig = object;

/** Present when the chatbot has an Attachments node; the client may send attachments with messages. */
export type AttachmentsConfig = object;

/**
 * Assemble the full system prompt for a chatbot: base_prompt + contributions from each linked node.
 * When userContext (userId / teamId) is provided, data_access nodes load real data for that context into the prompt.
 * When a web_search node is linked, returns webSearch config so the chat API can enable Google Search grounding.
 * Pass dataFetchClient (service-role) for reading chatbot config and links (RLS restricts these to super_admin)
 * and for fetching user/team data. When omitted, supabase is used for config and data (admin-only flows).
 */
export async function assemblePrompt(
  supabase: SupabaseClient,
  chatbotId: string,
  userContext?: UserContext,
  dataFetchClient?: SupabaseClient
): Promise<{ prompt: string; chatbot: ChatbotRow | null; webSearch?: WebSearchConfig; attachments?: AttachmentsConfig }> {
  const configClient = dataFetchClient ?? supabase;
  const chatbot = await getChatbot(configClient, chatbotId);
  if (!chatbot) return { prompt: "", chatbot: null };

  const nodes = await getLinkedNodes(configClient, chatbotId);
  const baseText = (chatbot.base_prompts ?? [])
    .map((p) => (p.content ?? "").trim())
    .filter(Boolean)
    .join("\n\n") || "You are a helpful AI assistant.";
  const parts: string[] = [baseText];

  const hasUserContext = userContext && (userContext.userId || userContext.teamId);
  const clientForData = dataFetchClient ?? supabase;
  const emptyUserContext: UserContext = { userId: null, teamId: null };
  let webSearch: WebSearchConfig | undefined;
  let attachments: AttachmentsConfig | undefined;

  for (const node of nodes) {
    let dataContext: string | undefined;
    if (node.node_type === "data_access") {
      const settings = node.settings || {};
      const dataSource = (settings.data_source as string) || "";
      const scope = (settings.scope as string) || "team_specific";
      const isPlatformScope = scope === "all";
      // Fetch data when: user/team context is set, OR node is platform-wide (scope "all") so all accounts data is included
      if (hasUserContext && userContext) {
        dataContext = await fetchDataForSource(clientForData, dataSource, scope, userContext);
      } else if (isPlatformScope) {
        dataContext = await fetchDataForSource(clientForData, dataSource, scope, emptyUserContext);
      }
    }
    if (node.node_type === "web_search") {
      webSearch = {};
    }
    if (node.node_type === "attachments") {
      attachments = {};
    }
    const contribution = buildPromptFromNode(node, dataContext);
    if (contribution) parts.push(contribution);
  }

  const prompt = parts.join("\n\n");
  return { prompt, chatbot, webSearch, attachments };
}

export type InstructionBlock = { nodeName: string; content: string };
export type DataModule = { nodeName: string; label: string; dataSource: string; content: string };

export type AssembledStructured = {
  prompt: string;
  chatbot: ChatbotRow | null;
  basePrompt: string;
  instructionBlocks: InstructionBlock[];
  dataModules: DataModule[];
  webSearch?: WebSearchConfig;
  attachments?: AttachmentsConfig;
};

/**
 * Same as assemblePrompt but returns a breakdown for display: base prompt, each instruction block, each data module, and full prompt.
 * Pass dataFetchClient (service-role) for reading chatbot config and links (RLS restricts these to super_admin) and for data fetch.
 */
export async function assemblePromptStructured(
  supabase: SupabaseClient,
  chatbotId: string,
  userContext?: UserContext,
  dataFetchClient?: SupabaseClient
): Promise<AssembledStructured> {
  const configClient = dataFetchClient ?? supabase;
  const chatbot = await getChatbot(configClient, chatbotId);
  const empty: AssembledStructured = {
    prompt: "",
    chatbot: null,
    basePrompt: "",
    instructionBlocks: [],
    dataModules: [],
  };
  if (!chatbot) return empty;

  const nodes = await getLinkedNodes(configClient, chatbotId);
  let webSearch: WebSearchConfig | undefined;
  let attachments: AttachmentsConfig | undefined;
  const basePrompt = (chatbot.base_prompts ?? [])
    .map((p) => (p.content ?? "").trim())
    .filter(Boolean)
    .join("\n\n") || "You are a helpful AI assistant.";
  const parts: string[] = [basePrompt];
  const instructionBlocks: InstructionBlock[] = [];
  const dataModules: DataModule[] = [];
  const hasUserContext = userContext && (userContext.userId || userContext.teamId);
  const clientForData = dataFetchClient ?? supabase;
  const emptyUserContext: UserContext = { userId: null, teamId: null };

  for (const node of nodes) {
    let dataContext: string | undefined;
    const settings = node.settings || {};
    const dataSource = (settings.data_source as string) || "";
    const scope = (settings.scope as string) || "team_specific";
    const isPlatformScope = scope === "all";

    if (node.node_type === "data_access") {
      const label = DATA_SOURCE_LABELS[dataSource] || dataSource;
      if (hasUserContext && userContext) {
        dataContext = await fetchDataForSource(clientForData, dataSource, scope, userContext);
        dataModules.push({
          nodeName: node.name,
          label,
          dataSource,
          content: dataContext || "(No data for this context)",
        });
      } else if (isPlatformScope) {
        dataContext = await fetchDataForSource(clientForData, dataSource, scope, emptyUserContext);
        dataModules.push({
          nodeName: node.name,
          label,
          dataSource,
          content: dataContext || "(No data for this context)",
        });
      } else {
        dataModules.push({
          nodeName: node.name,
          label,
          dataSource,
          content: "(Select a user above to see data for this source)",
        });
      }
    }

    if (node.node_type === "web_search") {
      webSearch = {};
    }
    if (node.node_type === "attachments") {
      attachments = {};
    }

    const contribution = buildPromptFromNode(node, dataContext);
    if (contribution) parts.push(contribution);
  }

  const prompt = parts.join("\n\n");
  return {
    prompt,
    chatbot,
    basePrompt,
    instructionBlocks,
    dataModules,
    webSearch,
    attachments,
  };
}

/**
 * Data fetching utilities for ElevenLabs Voice Agent tool APIs
 *
 * Extracted from lib/chatbot-flow/assemble-prompt.ts for reuse in tool APIs.
 * Uses the same DATA_SOURCE_CONFIG and scoping logic.
 */

import { createClient } from "@supabase/supabase-js";
import type { UserContext, Scope, DataSourceConfig } from "./types";

const MAX_DATA_ROWS = 30;

/**
 * Table, select columns, and which column to filter by for team vs user scope.
 * Copied from lib/chatbot-flow/assemble-prompt.ts to avoid circular imports.
 */
export const DATA_SOURCE_CONFIG: Record<string, DataSourceConfig> = {
  business_info: {
    table: "business_info",
    select:
      "id, user_id, full_name, business_name, email, phone_number, payment_option, payment_remaining, command_hq_link, command_hq_created, gd_folder_created, meeting_scheduled, created_at, updated_at, profile_picture_url, role, google_review_link, team_id, permissions, job_title, manager, critical_accountabilities, playbooks_owned, department, manager_id, department_id, wbt_onboarding",
    teamColumn: "team_id",
    userColumn: "user_id",
  },
  business_owner_instructions: {
    table: "business_owner_instructions",
    select:
      "id, user_id, title, content, content_type, url, extraction_metadata, created_at, updated_at",
    userColumn: "user_id",
  },
  company_onboarding: {
    table: "company_onboarding",
    select:
      "id, user_id, onboarding_data, completed, competitor_data, created_at, updated_at",
    userColumn: "user_id",
  },
  departments: {
    table: "departments",
    select: "id, name, team_id, created_at, updated_at",
    teamColumn: "team_id",
  },
  finance_analysis: {
    table: "finance_analysis",
    select:
      "id, file_id, user_id, team_id, analysis_result, summary, status, created_at, updated_at, period_type",
    teamColumn: "team_id",
    userColumn: "user_id",
  },
  google_calendar_events: {
    table: "google_calendar_events",
    select:
      "id, user_id, title, description, location, start_time, end_time, all_day, status, created_at, updated_at",
    userColumn: "user_id",
  },
  global_services: {
    table: "global_services",
    select:
      "id, service_name, description, category, is_active, created_at, updated_at, display_order",
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
    select:
      "id, user_id, enginename, enginetype, description, triggeringevents, endingevent, actionsactivities, created_at, updated_at, figma_link, figma_embed, image_url, image_urls, welcome_completed, questions, answers, questions_completed, ai_assisted, service_name, service_id, subcategory_id, team_service_id",
    userColumn: "user_id",
  },
  performance_kpis: {
    table: "performance_kpis",
    select:
      "id, session_id, revenue, revenue_status, ad_spend, leads, jobs_completed, roas, roi_pounds, roi_percent, google_reviews, created_at, updated_at",
  },
  playbook_assignments: {
    table: "playbook_assignments",
    select: "id, user_id, playbook_id, assignment_type, created_at",
  },
  software: {
    table: "software",
    select:
      "id, software, url, description, price_monthly, department_id, team_id, pricing_period, created_at, updated_at",
    teamColumn: "team_id",
  },
  sop_data: {
    table: "sop_data",
    select:
      "id, user_id, title, content, version, is_current, created_at, updated_at, metadata",
    userColumn: "user_id",
  },
  tasks: {
    table: "tasks",
    select:
      "id, title, description, links, task_type, status, priority, start_date, due_date, assigned_to, created_by, team_id, created_at, updated_at",
    teamColumn: "team_id",
    userColumn: "assigned_to",
  },
  team_leaves: {
    table: "team_leaves",
    select:
      "id, user_id, leave_type, start_date, end_date, status, duration_days, description, created_at, updated_at",
    userColumn: "user_id",
  },
  team_services: {
    table: "team_services",
    select: "id, team_id, service_id, created_at, updated_at",
    teamColumn: "team_id",
  },
  battle_plan: {
    table: "battle_plan",
    select:
      "id, user_id, businessplanlink, missionstatement, visionstatement, purposewhy, strategicanchors, corevalues, business_plan_content, oneyeartarget, tenyeartarget, fiveyeartarget, static_questions_answers, created_at, updated_at",
    userColumn: "user_id",
  },
  playbooks: {
    table: "playbooks",
    select:
      "id, user_id, playbookname, description, enginetype, status, link, department_id, content, created_at, updated_at",
    userColumn: "user_id",
  },
};

/**
 * Get admin Supabase client (service role) that bypasses RLS.
 * Used for fetching data in tool APIs.
 */
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Fetch data for a tool, applying proper scoping.
 *
 * @param toolKey - The tool/data source key (e.g., "tasks", "business_info")
 * @param scope - The scope to apply: "user_specific", "team_specific", or "all"
 * @param context - User context with userId and teamId
 * @param limit - Maximum number of rows to return (default: 30)
 * @returns Array of data rows, or empty array if no data/error
 */
export async function fetchToolData(
  toolKey: string,
  scope: Scope,
  context: UserContext,
  limit: number = MAX_DATA_ROWS
): Promise<unknown[]> {
  const config = DATA_SOURCE_CONFIG[toolKey];
  if (!config) {
    console.warn(`[agent-tools] Unknown tool key: ${toolKey}`);
    return [];
  }

  const { userId, teamId } = context;
  const supabase = getAdminClient();

  // Determine which filter to apply based on scope and available columns
  const teamFilter =
    scope === "team_specific" && config.teamColumn && teamId;
  const userFilter =
    scope === "user_specific" && config.userColumn && userId;
  const teamFallbackToUser =
    scope === "team_specific" &&
    !config.teamColumn &&
    config.userColumn &&
    userId;
  const isAllScope = scope === "all";

  let query = supabase.from(config.table).select(config.select);

  if (teamFilter && config.teamColumn) {
    query = query.eq(config.teamColumn, teamId);
  } else if (userFilter && config.userColumn) {
    query = query.eq(config.userColumn, userId);
  } else if (teamFallbackToUser && config.userColumn) {
    query = query.eq(config.userColumn, userId);
  } else if (!isAllScope && !teamFilter && !userFilter && !teamFallbackToUser) {
    // No valid filter and not platform-wide scope - return empty
    return [];
  }
  // scope "all" (platform-wide): no filter applied

  try {
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`[agent-tools] ❌ ${toolKey} error:`, error.message);
      return [];
    }

    console.log(`[agent-tools] ✅ ${toolKey} returned ${data?.length || 0} rows (scope: ${scope})`);
    return data || [];
  } catch (e) {
    console.error(`[agent-tools] ❌ ${toolKey} exception:`, e);
    return [];
  }
}

/**
 * Get the default scope for a tool based on its supported columns.
 */
export function getDefaultScope(toolKey: string): Scope {
  const config = DATA_SOURCE_CONFIG[toolKey];
  if (!config) return "team_specific";

  // If no team or user column, it's platform-wide
  if (!config.teamColumn && !config.userColumn) {
    return "all";
  }

  // If has team column, default to team_specific
  if (config.teamColumn) {
    return "team_specific";
  }

  // Otherwise default to user_specific
  return "user_specific";
}

/**
 * Check if a scope is valid for a tool.
 */
export function isValidScope(toolKey: string, scope: Scope): boolean {
  const config = DATA_SOURCE_CONFIG[toolKey];
  if (!config) return false;

  switch (scope) {
    case "all":
      // Platform-wide is always valid (returns all data or filtered based on columns)
      return true;
    case "team_specific":
      // Valid if has team column, or has user column (falls back to user)
      return Boolean(config.teamColumn || config.userColumn);
    case "user_specific":
      // Valid only if has user column
      return Boolean(config.userColumn);
    default:
      return false;
  }
}

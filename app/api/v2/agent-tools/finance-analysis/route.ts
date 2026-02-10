/**
 * Finance Analysis Tool API for ElevenLabs Voice Agent
 *
 * Fetches financial metrics and analysis summaries.
 * Supports team_specific and user_specific scopes.
 */

import {
  validateToolRequest,
  toolErrorResponse,
  toolSuccessResponse,
} from "../_lib/auth";
import { fetchToolData, getDefaultScope } from "../_lib/fetch-data";
import type { Scope } from "../_lib/types";

const TOOL_KEY = "finance_analysis";

export async function POST(req: Request) {
  const auth = await validateToolRequest(req);
  if (!auth.valid) {
    return toolErrorResponse(auth.error || "Unauthorized", 401);
  }

  let scope: Scope = getDefaultScope(TOOL_KEY);
  let limit = 30;

  try {
    const body = await req.json();
    if (body.scope) scope = body.scope as Scope;
    if (body.limit) limit = Math.min(body.limit, 100);
  } catch {
    // Use defaults
  }

  const data = await fetchToolData(
    TOOL_KEY,
    scope,
    { userId: auth.userId, teamId: auth.teamId },
    limit
  );

  return toolSuccessResponse(data, {
    count: data.length,
    scope,
    tool_key: TOOL_KEY,
  });
}

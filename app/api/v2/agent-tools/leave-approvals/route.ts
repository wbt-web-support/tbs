/**
 * Leave Approvals Tool API for ElevenLabs Voice Agent
 *
 * Fetches leave approval history.
 * Only supports user_specific scope (approver_id).
 */

import {
  validateToolRequest,
  toolErrorResponse,
  toolSuccessResponse,
} from "../_lib/auth";
import { fetchToolData } from "../_lib/fetch-data";
import type { Scope } from "../_lib/types";

const TOOL_KEY = "leave_approvals";

export async function POST(req: Request) {
  const auth = await validateToolRequest(req);
  if (!auth.valid) {
    return toolErrorResponse(auth.error || "Unauthorized", 401);
  }

  const scope: Scope = "user_specific";
  let limit = 30;

  try {
    const body = await req.json();
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

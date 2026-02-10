/**
 * Team Services Tool API for ElevenLabs Voice Agent
 *
 * Fetches services enabled for the team.
 * Only supports team_specific scope.
 */

import {
  validateToolRequest,
  toolErrorResponse,
  toolSuccessResponse,
} from "../_lib/auth";
import { fetchToolData } from "../_lib/fetch-data";
import type { Scope } from "../_lib/types";

const TOOL_KEY = "team_services";

export async function POST(req: Request) {
  const auth = await validateToolRequest(req);
  if (!auth.valid) {
    return toolErrorResponse(auth.error || "Unauthorized", 401);
  }

  const scope: Scope = "team_specific";
  let limit = 50;

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

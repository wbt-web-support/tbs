/**
 * Tasks Tool API for ElevenLabs Voice Agent
 *
 * Fetches tasks with priority, status, and due dates.
 * Supports team_specific and user_specific scopes.
 */

import { NextResponse } from "next/server";
import {
  validateToolRequest,
  toolErrorResponse,
  toolSuccessResponse,
} from "../_lib/auth";
import { fetchToolData, getDefaultScope } from "../_lib/fetch-data";
import type { Scope } from "../_lib/types";

const TOOL_KEY = "tasks";

export async function POST(req: Request) {
  // Validate the request
  const auth = await validateToolRequest(req);
  if (!auth.valid) {
    return toolErrorResponse(auth.error || "Unauthorized", 401);
  }

  // Parse request body for additional parameters
  let scope: Scope = getDefaultScope(TOOL_KEY);
  let status: string | undefined;
  let limit = 30;

  try {
    const body = await req.json();
    if (body.scope) scope = body.scope as Scope;
    if (body.status) status = body.status;
    if (body.limit) limit = Math.min(body.limit, 100);
  } catch {
    // Body parsing failed, use defaults
  }

  // Fetch data with scoping
  const data = await fetchToolData(
    TOOL_KEY,
    scope,
    { userId: auth.userId, teamId: auth.teamId },
    limit
  );

  // Optional: filter by status if provided
  const filtered = status
    ? data.filter((t: unknown) => {
        const task = t as { status?: string };
        return task.status === status;
      })
    : data;

  return toolSuccessResponse(filtered, {
    count: filtered.length,
    scope,
    tool_key: TOOL_KEY,
  });
}

/**
 * Authentication utilities for ElevenLabs Voice Agent tool APIs
 *
 * These endpoints are called by ElevenLabs as webhooks.
 * Authentication is via bearer token (ELEVENLABS_TOOL_SECRET).
 * User context (user_id, team_id) is passed via dynamic_variables from ElevenLabs.
 */

import type { ToolAuthResult } from "./types";

/**
 * Validate a tool request from ElevenLabs
 * - Checks bearer token matches ELEVENLABS_TOOL_SECRET
 * - Extracts user_id and team_id from request body (dynamic_variables)
 *
 * @param req - The incoming request
 * @returns Auth result with validity, user context, or error
 */
export async function validateToolRequest(req: Request): Promise<ToolAuthResult> {
  const secret = process.env.ELEVENLABS_TOOL_SECRET;

  if (!secret) {
    console.error("[agent-tools] ELEVENLABS_TOOL_SECRET is not configured");
    return { valid: false, error: "Server configuration error" };
  }

  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Invalid Authorization format. Expected: Bearer <token>" };
  }

  const token = authHeader.slice(7);

  if (token !== secret) {
    return { valid: false, error: "Invalid token" };
  }

  // Parse request body to get user context from dynamic_variables
  try {
    const body = await req.clone().json();

    // ElevenLabs passes dynamic_variables which include user_id and team_id
    console.log(`[agent-tools] 📥 Tool request received - user_id: ${body.user_id || 'none'}, team_id: ${body.team_id || 'none'}`);

    return {
      valid: true,
      userId: body.user_id || undefined,
      teamId: body.team_id || undefined,
    };
  } catch {
    // Body might not be JSON or might be empty - that's OK for auth
    console.log(`[agent-tools] 📥 Tool request received (no body)`);
    return { valid: true };
  }
}

/**
 * Create an error response for tool APIs
 */
export function toolErrorResponse(error: string, status: number = 400) {
  return Response.json(
    { success: false, error },
    { status }
  );
}

/**
 * Create a success response for tool APIs
 */
export function toolSuccessResponse<T>(
  data: T,
  metadata?: { count: number; scope: string; tool_key: string }
) {
  return Response.json({
    success: true,
    data,
    metadata,
  });
}

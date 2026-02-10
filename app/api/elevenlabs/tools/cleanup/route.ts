/**
 * ElevenLabs Workspace Tools Cleanup
 *
 * POST: Delete all workspace tools from ElevenLabs and reset elevenlabs_tool_id in DB.
 * Run once to clean up duplicate tools, then the next sync recreates them cleanly.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  listWorkspaceTools,
  deleteWorkspaceTool,
} from "@/lib/elevenlabs/agent-api";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function verifyAuth() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated", status: 401 };
  }

  const { data: userInfo } = await supabase
    .from("business_info")
    .select("role")
    .eq("user_id", session.user.id)
    .single();

  if (!userInfo || userInfo.role !== "super_admin") {
    return { error: "Unauthorized: Super admin access required", status: 403 };
  }

  return { userId: session.user.id };
}

/**
 * POST /api/elevenlabs/tools/cleanup
 * Delete all workspace tools and reset DB references
 */
export async function POST() {
  const auth = await verifyAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const adminClient = getAdminClient();

  try {
    // List all workspace tools from ElevenLabs
    const tools = await listWorkspaceTools();
    console.log(`[cleanup] Found ${tools.length} workspace tools to delete`);

    // Delete each workspace tool
    const deleted: string[] = [];
    const errors: string[] = [];

    for (const tool of tools) {
      try {
        await deleteWorkspaceTool(tool.tool_id);
        deleted.push(tool.tool_id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[cleanup] Failed to delete tool ${tool.tool_id}:`, msg);
        errors.push(`${tool.tool_id}: ${msg}`);
      }
    }

    // Reset all elevenlabs_tool_id values in DB
    const { error: dbError } = await adminClient
      .from("elevenlabs_tool_definitions")
      .update({ elevenlabs_tool_id: null })
      .not("elevenlabs_tool_id", "is", null);

    if (dbError) {
      console.error("[cleanup] DB reset error:", dbError);
    }

    return NextResponse.json({
      success: true,
      found: tools.length,
      deleted: deleted.length,
      errors: errors.length > 0 ? errors : undefined,
      db_reset: !dbError,
    });
  } catch (error) {
    console.error("[cleanup] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to clean up workspace tools",
      },
      { status: 500 }
    );
  }
}

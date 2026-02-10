/**
 * ElevenLabs Tools API
 *
 * GET: List all available tool definitions
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

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

  return { userId: session.user.id };
}

/**
 * GET /api/elevenlabs/tools
 * List all available tool definitions
 */
export async function GET() {
  const auth = await verifyAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const adminClient = getAdminClient();

  const { data: tools, error } = await adminClient
    .from("elevenlabs_tool_definitions")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("[elevenlabs/tools] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tools" },
      { status: 500 }
    );
  }

  return NextResponse.json({ tools: tools || [] });
}

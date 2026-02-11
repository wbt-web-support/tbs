/**
 * Public ElevenLabs Agents API
 *
 * GET /api/elevenlabs/agents/public
 * Returns active, synced agents for any authenticated user.
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

export async function GET() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const adminClient = getAdminClient();

  const { data: agents, error } = await adminClient
    .from("elevenlabs_agents")
    .select("id, name, description, elevenlabs_agent_id")
    .eq("is_active", true)
    .not("elevenlabs_agent_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[elevenlabs/agents/public] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }

  return NextResponse.json({ agents: agents || [] });
}

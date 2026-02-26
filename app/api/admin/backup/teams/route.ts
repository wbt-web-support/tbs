/**
 * GET /api/admin/backup/teams
 * Returns list of teams for backup scope dropdown (super_admin only).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

async function verifySuperAdmin() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("business_info")
    .select("role")
    .eq("user_id", session.user.id)
    .single();
  if (error || !data || data.role !== "super_admin") {
    throw new Error("Unauthorized: Super admin access required");
  }
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  try {
    await verifySuperAdmin();
    const admin = getAdminClient();
    const { data: rows, error } = await admin
      .from("business_info")
      .select("team_id, business_name")
      .not("team_id", "is", null);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    const byTeam = new Map<string, string>();
    for (const r of rows ?? []) {
      const tid = (r as { team_id: string }).team_id;
      const name = (r as { business_name: string }).business_name || tid;
      if (!byTeam.has(tid)) byTeam.set(tid, name);
    }
    const teams = Array.from(byTeam.entries()).map(([team_id, business_name]) => ({
      team_id,
      business_name,
    }));
    return NextResponse.json({ success: true, teams });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list teams";
    if (message.includes("Unauthorized") || message.includes("Not authenticated")) {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

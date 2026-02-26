/**
 * GET /api/admin/backup/logs
 * Returns recent backup and restore log entries (super_admin only).
 */

import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
  try {
    await verifySuperAdmin();
    const admin = getAdminClient();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const { data: rows, error } = await admin
      .from("backup_restore_logs")
      .select("id, type, scope, backup_path, triggered_by_user_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json({ success: true, logs: [] });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, logs: rows ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load logs";
    if (message.includes("Unauthorized") || message.includes("Not authenticated")) {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/backup/delete - Delete a backup and log the deletion.
 * Body: { path: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const BACKUP_BUCKET = "database-backups";

async function listAllFiles(
  admin: ReturnType<typeof createServiceClient>,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) return [];
  const out: string[] = [];
  for (const item of data ?? []) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id != null) out.push(fullPath);
    else out.push(...(await listAllFiles(admin, bucket, fullPath)));
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const { data: roleData, error: roleError } = await supabase
      .from("business_info")
      .select("role")
      .eq("user_id", session.user.id)
      .single();
    if (roleError || !roleData || roleData.role !== "super_admin") {
      throw new Error("Unauthorized: Super admin access required");
    }

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await request.json().catch(() => ({}));
    const path = typeof body.path === "string" ? body.path.trim() : "";
    if (!path) {
      return NextResponse.json({ success: false, error: "path is required" }, { status: 400 });
    }

    const allPaths = await listAllFiles(admin, BACKUP_BUCKET, path);
    if (allPaths.length > 0) {
      const { error: removeError } = await admin.storage.from(BACKUP_BUCKET).remove(allPaths);
      if (removeError) {
        return NextResponse.json({ success: false, error: removeError.message }, { status: 500 });
      }
    }

    try {
      await admin.from("backup_restore_logs").insert({
        type: "backup_deleted",
        scope: "all",
        backup_path: path,
        triggered_by_user_id: session.user.id,
        details: { files_removed: allPaths.length },
      });
    } catch {
      // log table may not exist
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    if (message.includes("Unauthorized") || message.includes("Not authenticated")) {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

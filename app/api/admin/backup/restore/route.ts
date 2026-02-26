/**
 * POST /api/admin/backup/restore
 * Restore from a backup. Body: { backupPath: string, confirm: true }
 * Overwrites current data for the backup scope.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const BACKUP_BUCKET = "database-backups";

const TABLES_RESTORE_ORDER: readonly string[] = [
  "departments",
  "business_info",
  "team_services",
  "machines",
  "battle_plan",
  "team_hierarchy_design",
  "document_history",
  "company_onboarding",
];

const TABLES_DELETE_ORDER: readonly string[] = [
  "document_history",
  "battle_plan",
  "business_info",
  "team_hierarchy_design",
  "departments",
  "machines",
  "team_services",
  "company_onboarding",
];

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

    const admin = getAdminClient();

    const body = await request.json().catch(() => ({}));
    const backupPath = typeof body.backupPath === "string" ? body.backupPath.trim() : "";
    const confirm = body.confirm === true;

    if (!backupPath) {
      return NextResponse.json({ success: false, error: "backupPath is required" }, { status: 400 });
    }
    if (!confirm) {
      return NextResponse.json(
        { success: false, error: "Restore requires confirm: true. This will overwrite current data." },
        { status: 400 }
      );
    }

    const dataPath = backupPath.endsWith("data.json") ? backupPath : `${backupPath.replace(/\/$/, "")}/data.json`;
    const { data: fileData, error: downloadError } = await admin.storage.from(BACKUP_BUCKET).download(dataPath);
    if (downloadError || !fileData) {
      return NextResponse.json({ success: false, error: "Backup not found" }, { status: 404 });
    }

    const text = await fileData.text();
    const payload = JSON.parse(text) as {
      scope?: string;
      tables?: Record<string, unknown[]>;
      storageManifest?: { bucket: string; path: string; backupPath: string }[];
    };

    const scope = payload.scope ?? "all";
    const tables = payload.tables ?? {};
    const storageManifest = payload.storageManifest ?? [];

    let teamMemberIds: string[] = [];
    if (scope !== "all") {
      const { data: members } = await admin.from("business_info").select("user_id").eq("team_id", scope);
      teamMemberIds = (members ?? []).map((r: { user_id: string }) => r.user_id);
    }

    async function deleteAllInTable(t: string) {
      let deleted = 0;
      do {
        const { data: batch } = await admin.from(t).select("id").limit(100);
        if (!batch?.length) break;
        const ids = batch.map((r: { id: string }) => r.id);
        await admin.from(t).delete().in("id", ids);
        deleted += batch.length;
      } while (deleted > 0);
    }

    for (const table of TABLES_DELETE_ORDER) {
      const rows = tables[table] as unknown[] | undefined;

      if (scope === "all") {
        await deleteAllInTable(table);
      } else {
        if (table === "company_onboarding") {
          if (teamMemberIds.length) {
            await admin.from(table).delete().in("user_id", teamMemberIds);
          } else {
            await admin.from(table).delete().eq("user_id", scope);
          }
        } else if (table === "document_history" || table === "battle_plan" || table === "machines") {
          await admin.from(table).delete().eq("user_id", scope);
        } else if (
          table === "team_services" ||
          table === "departments" ||
          table === "business_info" ||
          table === "team_hierarchy_design"
        ) {
          await admin.from(table).delete().eq("team_id", scope);
        }
      }
    }

    for (const table of TABLES_RESTORE_ORDER) {
      const rows = tables[table] as Record<string, unknown>[] | undefined;
      if (!rows?.length) continue;
      const { error: insError } = await admin.from(table).insert(rows);
      if (insError) {
        console.error(`Restore insert ${table}:`, insError);
        return NextResponse.json(
          { success: false, error: `Failed to restore table ${table}: ${insError.message}` },
          { status: 500 }
        );
      }
    }

    for (const entry of storageManifest) {
      const { backupPath: downloadPath, bucket, path } = entry;
      const { data: blob, error: downErr } = await admin.storage.from(BACKUP_BUCKET).download(downloadPath);
      if (downErr || !blob) continue;
      await admin.storage.from(bucket).upload(path, blob, {
        contentType: blob.type || "application/octet-stream",
        upsert: true,
      });
    }

    try {
      await admin.from("backup_restore_logs").insert({
        type: "restore",
        scope: payload.scope ?? "all",
        backup_path: backupPath,
        triggered_by_user_id: session.user.id,
        details: { storage_files_restored: storageManifest.length },
      });
    } catch {
      // Log table may not exist yet; restore still succeeded
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Restore failed";
    if (message.includes("Unauthorized") || message.includes("Not authenticated")) {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

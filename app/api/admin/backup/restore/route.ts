/**
 * POST /api/admin/backup/restore
 * Restore from a backup. Body: { backupPath: string, confirm: true, restoreScope?: string }
 * Overwrites current data for the backup scope.
 *
 * Uses upsert for inserts so a partial failure doesn't leave the DB empty.
 * Only deletes rows that exist in DB but NOT in backup (cleanup after upsert).
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
  "admin_page_permissions",
];

// Children before parents to respect FK constraints during deletes
const TABLES_CLEANUP_ORDER: readonly string[] = [
  "admin_page_permissions",
  "document_history",
  "company_onboarding",
  "battle_plan",
  "team_hierarchy_design",
  "machines",
  "team_services",
  "business_info",
  "departments",
];

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getScopeFilter(table: string): { column: string; type: "eq" | "in" } {
  switch (table) {
    case "company_onboarding":
      return { column: "user_id", type: "in" };
    case "document_history":
    case "battle_plan":
    case "machines":
      return { column: "user_id", type: "eq" };
    case "admin_page_permissions":
      return { column: "admin_user_id", type: "in" };
    default:
      return { column: "team_id", type: "eq" };
  }
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
    const restoreScope = typeof body.restoreScope === "string" ? body.restoreScope.trim() || null : null;

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

    let scope = payload.scope ?? "all";
    let tables = payload.tables ?? {};
    let storageManifest = payload.storageManifest ?? [];

    if (scope === "all" && restoreScope) {
      const teamId = restoreScope;
      const businessInfoRows = (tables.business_info ?? []) as { id: string; team_id: string; user_id: string }[];
      const teamBizIds = new Set(businessInfoRows.filter((r) => r.team_id === teamId).map((r) => r.id));
      const teamUserIds = new Set(businessInfoRows.filter((r) => r.team_id === teamId).map((r) => r.user_id));
      const teamMachineIds = new Set(
        ((tables.machines ?? []) as { id: string; user_id: string }[]).filter((r) => r.user_id === teamId).map((r) => r.id)
      );
      const teamDesignIds = new Set(
        ((tables.team_hierarchy_design ?? []) as { id: string; team_id: string }[]).filter((r) => r.team_id === teamId).map((r) => r.id)
      );
      tables = {
        machines: ((tables.machines ?? []) as { user_id: string }[]).filter((r) => r.user_id === teamId),
        team_services: ((tables.team_services ?? []) as { team_id: string }[]).filter((r) => r.team_id === teamId),
        battle_plan: ((tables.battle_plan ?? []) as { user_id: string }[]).filter((r) => r.user_id === teamId),
        document_history: ((tables.document_history ?? []) as { user_id: string }[]).filter((r) => r.user_id === teamId),
        business_info: businessInfoRows.filter((r) => r.team_id === teamId),
        team_hierarchy_design: ((tables.team_hierarchy_design ?? []) as { team_id: string }[]).filter((r) => r.team_id === teamId),
        departments: ((tables.departments ?? []) as { team_id: string }[]).filter((r) => r.team_id === teamId),
        company_onboarding: ((tables.company_onboarding ?? []) as { user_id: string }[]).filter((r) => teamUserIds.has(r.user_id)),
        admin_page_permissions: ((tables.admin_page_permissions ?? []) as { admin_user_id: string }[]).filter((r) => teamBizIds.has(r.admin_user_id)),
      };
      storageManifest = storageManifest.filter((e) => {
        if (e.bucket === "ai-instructions" && e.path.startsWith(`business-plan/${teamId}/`)) return true;
        if (e.bucket === "profiles") {
          const topDir = e.path.split("/")[0];
          return teamUserIds.has(topDir);
        }
        if (e.bucket !== "machines") return false;
        const name = e.path.split("/").pop() ?? "";
        const idPart = name.split("_")[0];
        if (e.path.startsWith("team_hierarchy/")) return teamDesignIds.has(idPart);
        if (e.path.startsWith("growth_machines/") || e.path.startsWith("fulfillment_machines/")) return teamMachineIds.has(idPart);
        return false;
      });
      scope = teamId;
    }

    let teamMemberIds: string[] = [];
    if (scope !== "all") {
      const businessInfoRows = (tables.business_info ?? []) as { user_id: string }[];
      teamMemberIds = businessInfoRows.map((r) => r.user_id);
      if (!teamMemberIds.length) {
        const { data: members } = await admin.from("business_info").select("user_id").eq("team_id", scope);
        teamMemberIds = (members ?? []).map((r: { user_id: string }) => r.user_id);
      }
    }

    const bizIds = ((tables.business_info ?? []) as { id: string }[]).map((r) => r.id);

    // Tables with UNIQUE constraints beyond PK — map table -> unique column
    const UNIQUE_CONSTRAINTS: Record<string, string> = {
      team_hierarchy_design: "team_id",
      business_info: "user_id",
      company_onboarding: "user_id",
    };

    // --- PRE-CLEANUP: remove rows whose unique column conflicts with backup data ---
    // e.g. DB has (id=A, team_id=T1) and backup has (id=B, team_id=T1)
    // Upsert on id would INSERT id=B but hit the team_id unique constraint.
    // Fix: delete the conflicting row (id=A) first so the upsert can succeed.
    for (const table of TABLES_CLEANUP_ORDER) {
      const uniqueCol = UNIQUE_CONSTRAINTS[table];
      if (!uniqueCol) continue;
      const rows = tables[table] as Record<string, unknown>[] | undefined;
      if (!rows?.length) continue;

      const backupIds = new Set(rows.map((r) => r.id as string));
      const backupUniqueValues = rows.map((r) => r[uniqueCol] as string).filter(Boolean);
      if (!backupUniqueValues.length) continue;

      for (let i = 0; i < backupUniqueValues.length; i += 100) {
        const batch = backupUniqueValues.slice(i, i + 100);
        const { data: conflicts } = await admin
          .from(table)
          .select("id")
          .in(uniqueCol, batch);
        const conflictIds = (conflicts ?? [])
          .map((r: { id: string }) => r.id)
          .filter((id) => !backupIds.has(id));
        if (conflictIds.length) {
          await admin.from(table).delete().in("id", conflictIds);
        }
      }
    }

    // --- UPSERT phase: insert or update all rows from backup ---
    for (const table of TABLES_RESTORE_ORDER) {
      const rows = tables[table] as Record<string, unknown>[] | undefined;
      if (!rows?.length) continue;

      const BATCH = 200;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error: upsertError } = await admin.from(table).upsert(batch, { onConflict: "id" });
        if (upsertError) {
          console.error(`Restore upsert ${table} batch ${i}:`, upsertError);
          return NextResponse.json(
            { success: false, error: `Failed to restore table ${table}: ${upsertError.message}` },
            { status: 500 }
          );
        }
      }
    }

    // --- CLEANUP phase: delete rows in DB that are NOT in the backup for this scope ---
    // Uses TABLES_CLEANUP_ORDER (children first) to avoid FK constraint violations
    for (const table of TABLES_CLEANUP_ORDER) {
      const rows = tables[table] as { id: string }[] | undefined;
      const backupIds = new Set((rows ?? []).map((r) => r.id));

      let existingIds: string[] = [];
      if (scope === "all") {
        const { data: existing } = await admin.from(table).select("id");
        existingIds = (existing ?? []).map((r: { id: string }) => r.id);
      } else {
        const filter = getScopeFilter(table);
        if (filter.type === "in") {
          const filterValues = table === "admin_page_permissions" ? bizIds : teamMemberIds;
          if (filterValues.length) {
            const { data: existing } = await admin.from(table).select("id").in(filter.column, filterValues);
            existingIds = (existing ?? []).map((r: { id: string }) => r.id);
          }
        } else {
          const { data: existing } = await admin.from(table).select("id").eq(filter.column, scope);
          existingIds = (existing ?? []).map((r: { id: string }) => r.id);
        }
      }

      const toDelete = existingIds.filter((id) => !backupIds.has(id));
      if (toDelete.length > 0) {
        for (let i = 0; i < toDelete.length; i += 100) {
          await admin.from(table).delete().in("id", toDelete.slice(i, i + 100));
        }
      }
    }

    // --- STORAGE phase: restore files ---
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
        scope,
        backup_path: backupPath,
        triggered_by_user_id: session.user.id,
        details: { storage_files_restored: storageManifest.length, restoreScope: restoreScope ?? undefined },
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

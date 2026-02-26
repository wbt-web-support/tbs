/**
 * Superadmin Database Backup API
 *
 * POST /api/admin/backup - Create backup (body: { scope: "all" | team_id })
 * GET  /api/admin/backup - List backups; ?path=... to download data.json
 *
 * Backs up DB tables + storage (machines, ai-instructions business-plan).
 * One folder per backup: {date}/{backupId}/data.json + storage/{bucket}/{path}
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const BACKUP_BUCKET = "database-backups";
const MACHINES_BUCKET = "machines";
const AI_INSTRUCTIONS_BUCKET = "ai-instructions";
const BUSINESS_PLAN_PREFIX = "business-plan";

const TABLES_TO_BACKUP = [
  "machines",
  "team_services",
  "battle_plan",
  "document_history",
  "business_info",
  "team_hierarchy_design",
  "departments",
  "company_onboarding",
] as const;

const MACHINE_STORAGE_PREFIXES = ["growth_machines", "fulfillment_machines", "team_hierarchy"];

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

/** Ensure database-backups bucket exists (create with service role if not). */
async function ensureBackupBucket(
  admin: ReturnType<typeof createServiceClient>
): Promise<void> {
  const { data, error: getError } = await admin.storage.getBucket(BACKUP_BUCKET);
  if (data) return; // bucket exists

  // Bucket missing or inaccessible — create it (50MB limit for Free tier compatibility)
  const { error: createError } = await admin.storage.createBucket(BACKUP_BUCKET, {
    public: false,
    fileSizeLimit: 52428800, // 50MB (Supabase Free tier max; Pro/Team can increase in Dashboard)
  });

  if (createError) {
    if (createError.message?.includes("already exists") || createError.message?.toLowerCase().includes("duplicate")) {
      return; // created by another request or exists now
    }
    throw new Error(`Failed to create backup bucket: ${createError.message}`);
  }
}

/** List all file paths under a storage prefix recursively */
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

    const admin = getAdminClient();
    await ensureBackupBucket(admin);

    let scope: "all" | string = "all";
    try {
      const body = await request.json();
      if (body && typeof body.scope === "string" && body.scope.trim()) {
        scope = body.scope.trim();
      }
    } catch {
      // default scope remains "all"
    }

    const exportedAt = new Date().toISOString();
    const dateStr = exportedAt.slice(0, 10);
    const timeStr = exportedAt.slice(11, 19).replace(/:/g, "-");
    const scopeSuffix = scope === "all" ? "all" : scope.replace(/[^a-zA-Z0-9-]/g, "_").slice(0, 36);
    const backupId = `backup-${dateStr}-${timeStr}-${scopeSuffix}`;
    const dateFolder = dateStr;
    const backupPrefix = `${dateFolder}/${backupId}`;

    let teamMemberIds: string[] = [];
    if (scope !== "all") {
      const { data: members } = await admin
        .from("business_info")
        .select("user_id")
        .eq("team_id", scope);
      teamMemberIds = (members ?? []).map((r: { user_id: string }) => r.user_id);
    }

    const tablesPayload: Record<string, unknown[]> = {};

    if (scope === "all") {
      for (const table of TABLES_TO_BACKUP) {
        const { data, error } = await admin.from(table).select("*");
        if (error) {
          console.error(`Backup error for table ${table}:`, error);
          tablesPayload[table] = [];
        } else {
          tablesPayload[table] = data ?? [];
        }
      }
    } else {
      const { data: battlePlanData } = await admin.from("battle_plan").select("id").eq("user_id", scope);
      const planIds = new Set((battlePlanData ?? []).map((r: { id: string }) => r.id));

      const { data: machinesData } = await admin.from("machines").select("id").eq("user_id", scope);
      const machineIds = new Set((machinesData ?? []).map((r: { id: string }) => r.id));

      const { data: designData } = await admin.from("team_hierarchy_design").select("id").eq("team_id", scope);
      const designIds = new Set((designData ?? []).map((r: { id: string }) => r.id));

      const { data: machinesRows } = await admin.from("machines").select("*").eq("user_id", scope);
      tablesPayload.machines = machinesRows ?? [];

      const { data: teamServicesRows } = await admin.from("team_services").select("*").eq("team_id", scope);
      tablesPayload.team_services = teamServicesRows ?? [];

      const { data: battlePlanRows } = await admin.from("battle_plan").select("*").eq("user_id", scope);
      tablesPayload.battle_plan = battlePlanRows ?? [];

      const { data: docHistoryRows } = await admin
        .from("document_history")
        .select("*")
        .in("user_id", [scope]);
      tablesPayload.document_history = docHistoryRows ?? [];

      const { data: businessInfoRows } = await admin.from("business_info").select("*").eq("team_id", scope);
      tablesPayload.business_info = businessInfoRows ?? [];

      const { data: designRows } = await admin.from("team_hierarchy_design").select("*").eq("team_id", scope);
      tablesPayload.team_hierarchy_design = designRows ?? [];

      const { data: deptRows } = await admin.from("departments").select("*").eq("team_id", scope);
      tablesPayload.departments = deptRows ?? [];

      const { data: onboardingRows } = await admin
        .from("company_onboarding")
        .select("*")
        .in("user_id", teamMemberIds.length ? teamMemberIds : [scope]);
      tablesPayload.company_onboarding = onboardingRows ?? [];
    }

    const storageManifest: { bucket: string; path: string; backupPath: string }[] = [];

    // Backup machines bucket (growth_machines, fulfillment_machines, team_hierarchy)
    let machineIdsFilter: Set<string> | null = null;
    let designIdsFilter: Set<string> | null = null;
    if (scope !== "all") {
      const { data: m } = await admin.from("machines").select("id").eq("user_id", scope);
      const { data: d } = await admin.from("team_hierarchy_design").select("id").eq("team_id", scope);
      machineIdsFilter = new Set((m ?? []).map((r: { id: string }) => r.id));
      designIdsFilter = new Set((d ?? []).map((r: { id: string }) => r.id));
    }

    for (const pre of MACHINE_STORAGE_PREFIXES) {
      const paths = await listAllFiles(admin, MACHINES_BUCKET, pre);
      for (const path of paths) {
        if (scope !== "all") {
          const namePart = path.split("/").pop() ?? "";
          const idPart = namePart.split("_")[0];
          const isDesign = pre === "team_hierarchy";
          if (isDesign && !designIdsFilter?.has(idPart)) continue;
          if (!isDesign && !machineIdsFilter?.has(idPart)) continue;
        }
        const { data: fileData, error: downError } = await admin.storage
          .from(MACHINES_BUCKET)
          .download(path);
        if (downError || !fileData) continue;
        const backupPath = `${backupPrefix}/storage/${MACHINES_BUCKET}/${path}`;
        const { error: upError } = await admin.storage
          .from(BACKUP_BUCKET)
          .upload(backupPath, fileData, { contentType: fileData.type || "application/octet-stream", upsert: true });
        if (!upError) storageManifest.push({ bucket: MACHINES_BUCKET, path, backupPath });
      }
    }

    // Backup ai-instructions business-plan prefix
    const bpPrefix = scope === "all" ? BUSINESS_PLAN_PREFIX : `${BUSINESS_PLAN_PREFIX}/${scope}`;
    const bpPaths = await listAllFiles(admin, AI_INSTRUCTIONS_BUCKET, bpPrefix);
    for (const path of bpPaths) {
      const { data: fileData, error: downError } = await admin.storage
        .from(AI_INSTRUCTIONS_BUCKET)
        .download(path);
      if (downError || !fileData) continue;
      const backupPath = `${backupPrefix}/storage/${AI_INSTRUCTIONS_BUCKET}/${path}`;
      const { error: upError } = await admin.storage
        .from(BACKUP_BUCKET)
        .upload(backupPath, fileData, { contentType: fileData.type || "application/octet-stream", upsert: true });
      if (!upError) storageManifest.push({ bucket: AI_INSTRUCTIONS_BUCKET, path, backupPath });
    }

    const payload = {
      exportedAt,
      scope,
      tables: tablesPayload,
      storageManifest,
    };

    const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const dataPath = `${backupPrefix}/data.json`;
    const { error: uploadError } = await admin.storage
      .from(BACKUP_BUCKET)
      .upload(dataPath, jsonBlob, { contentType: "application/json", upsert: true });

    if (uploadError) {
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
    }

    const tableCounts: Record<string, number> = {};
    for (const [t, rows] of Object.entries(tablesPayload)) {
      tableCounts[t] = Array.isArray(rows) ? rows.length : 0;
    }
    try {
      await admin.from("backup_restore_logs").insert({
        type: "backup",
        scope,
        backup_path: backupPrefix,
        triggered_by_user_id: session.user.id,
        details: { tables: tableCounts, storage_files: storageManifest.length },
      });
    } catch {
      // Log table may not exist yet; backup still succeeded
    }

    return NextResponse.json({
      success: true,
      path: backupPrefix,
      backupId,
      exportedAt,
      scope,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backup failed";
    if (message.includes("Unauthorized") || message.includes("Not authenticated")) {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await verifySuperAdmin();
    const admin = getAdminClient();
    await ensureBackupBucket(admin);
    const { searchParams } = new URL(request.url);
    const pathParam = searchParams.get("path");

    if (pathParam) {
      const dataPath = pathParam.endsWith("data.json") ? pathParam : `${pathParam.replace(/\/$/, "")}/data.json`;
      const { data: fileData, error } = await admin.storage.from(BACKUP_BUCKET).download(dataPath);
      if (error || !fileData) {
        return NextResponse.json({ success: false, error: "Backup not found" }, { status: 404 });
      }
      return new NextResponse(fileData, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="backup-data.json"`,
        },
      });
    }

    const { data: topLevel, error } = await admin.storage.from(BACKUP_BUCKET).list("", { limit: 200 });
    if (error) {
      if (error.message?.includes("not found") || error.message?.includes("Bucket")) {
        return NextResponse.json({ success: true, backups: [] });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const dateFolders = (topLevel ?? []).filter((f) => f.name && f.id == null).map((f) => f.name as string);
    const dateSorted = dateFolders.filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort((a, b) => b.localeCompare(a));

    const backups: { path: string; backupId: string; date: string; scope: string; exportedAt: string }[] = [];

    for (const date of dateSorted.slice(0, 31)) {
      const { data: dayItems } = await admin.storage.from(BACKUP_BUCKET).list(date, { limit: 100 });
      const folderNames = (dayItems ?? []).filter((f) => f.name && f.id == null).map((f) => f.name as string);
      for (const name of folderNames) {
        if (!name.startsWith("backup-")) continue;
        const backupPath = `${date}/${name}`;
        const { data: jsonFile } = await admin.storage.from(BACKUP_BUCKET).list(backupPath, { limit: 5 });
        const hasDataJson = (jsonFile ?? []).some((f) => f.name === "data.json");
        if (!hasDataJson) continue;
        const scopeFromId = name.replace(/^backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-/, "") || "all";
        backups.push({
          path: backupPath,
          backupId: name,
          date,
          scope: scopeFromId === "all" ? "all" : scopeFromId,
          exportedAt: `${date}T00:00:00.000Z`,
        });
      }
    }

    for (const b of backups) {
      try {
        const { data: blob } = await admin.storage.from(BACKUP_BUCKET).download(`${b.path}/data.json`);
        if (blob) {
          const text = await blob.text();
          const parsed = JSON.parse(text) as { exportedAt?: string; scope?: string };
          if (parsed.exportedAt) b.exportedAt = parsed.exportedAt;
          if (parsed.scope != null) b.scope = typeof parsed.scope === "string" ? parsed.scope : "all";
        }
      } catch {
        // keep defaults
      }
    }

    backups.sort((a, b) => b.exportedAt.localeCompare(a.exportedAt));

    return NextResponse.json({ success: true, backups });
  } catch (e) {
    const message = e instanceof Error ? e.message : "List backups failed";
    if (message.includes("Unauthorized") || message.includes("Not authenticated")) {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

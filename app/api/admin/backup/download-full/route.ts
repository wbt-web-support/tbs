/**
 * GET /api/admin/backup/download-full?path=...
 * Returns a ZIP containing data.json + all storage files for that backup.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import archiver from "archiver";
import { PassThrough, Readable } from "stream";

const BACKUP_BUCKET = "database-backups";

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
    const pathParam = searchParams.get("path");
    if (!pathParam?.trim()) {
      return NextResponse.json({ success: false, error: "path is required" }, { status: 400 });
    }
    const backupPath = pathParam.trim().replace(/\/$/, "");
    const dataPath = `${backupPath}/data.json`;

    const { data: jsonBlob, error: downloadError } = await admin.storage.from(BACKUP_BUCKET).download(dataPath);
    if (downloadError || !jsonBlob) {
      return NextResponse.json({ success: false, error: "Backup not found" }, { status: 404 });
    }

    const text = await jsonBlob.text();
    const payload = JSON.parse(text) as {
      storageManifest?: { bucket: string; path: string; backupPath: string }[];
    };
    const storageManifest = payload.storageManifest ?? [];

    const archive = archiver("zip", { zlib: { level: 9 } });
    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    archive.append(Buffer.from(text, "utf-8"), { name: "data.json" });

    for (const entry of storageManifest) {
      const { data: fileBlob, error: fileErr } = await admin.storage.from(BACKUP_BUCKET).download(entry.backupPath);
      if (fileErr || !fileBlob) continue;
      const buf = Buffer.from(await fileBlob.arrayBuffer());
      const zipEntryName = `storage/${entry.bucket}/${entry.path}`;
      archive.append(buf, { name: zipEntryName });
    }

    archive.finalize();

    const webStream = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>;
    const filename = `backup-${backupPath.replace(/\//g, "-")}.zip`;
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Download failed";
    if (message.includes("Unauthorized") || message.includes("Not authenticated")) {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

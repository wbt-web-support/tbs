"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { HardDrive, Download, RotateCcw, RefreshCw, Loader2, AlertTriangle, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TeamOption {
  team_id: string;
  business_name: string;
}

interface BackupItem {
  path: string;
  backupId: string;
  date: string;
  scope: string;
  exportedAt: string;
}

interface BackupLogEntry {
  id: string;
  type: "backup" | "restore" | "backup_deleted";
  scope: string;
  backup_path: string;
  triggered_by_user_id: string;
  details?: {
    tables?: Record<string, number>;
    storage_files?: number;
    storage_files_restored?: number;
    files_removed?: number;
  };
  created_at: string;
}

export default function AdminBackupPage() {
  const [activeTab, setActiveTab] = useState<"backup" | "logs">("backup");
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [scope, setScope] = useState<"all" | "single">("all");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoreBackup, setRestoreBackup] = useState<BackupItem | null>(null);
  const [restoreScopeTeamId, setRestoreScopeTeamId] = useState<string>("__all__");
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleteBackup, setDeleteBackup] = useState<BackupItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [logs, setLogs] = useState<BackupLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const fetchTeams = async () => {
    setLoadingTeams(true);
    try {
      const res = await fetch("/api/admin/backup/teams");
      const data = await res.json();
      if (data.success && data.teams) {
        setTeams(data.teams);
        if (data.teams.length && !selectedTeamId) {
          setSelectedTeamId(data.teams[0].team_id);
        }
      }
    } catch {
      toast.error("Failed to load teams");
    } finally {
      setLoadingTeams(false);
    }
  };

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch("/api/admin/backup");
      const data = await res.json();
      if (data.success && data.backups) {
        setBackups(data.backups);
      } else if (!data.success) {
        toast.error(data.error || "Failed to load backups");
      }
    } catch {
      toast.error("Failed to load backups");
    } finally {
      setLoadingBackups(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/admin/backup/logs?limit=30");
      const data = await res.json();
      if (data.success && data.logs) {
        setLogs(data.logs);
      }
    } catch {
      // non-blocking
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchTeams();
    fetchBackups();
    fetchLogs();
  }, []);

  const refreshAll = () => {
    fetchBackups();
    fetchLogs();
  };

  const handleCreateBackup = async () => {
    const scopeValue = scope === "all" ? "all" : selectedTeamId;
    if (scope === "single" && !scopeValue) {
      toast.error("Select an account");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: scopeValue }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Backup created");
        refreshAll();
      } else {
        toast.error(data.error || "Backup failed");
      }
    } catch {
      toast.error("Backup failed");
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = (path: string) => {
    const url = `/api/admin/backup/download-full?path=${encodeURIComponent(path)}`;
    window.open(url, "_blank");
    toast.success("Download started (ZIP with data + files)");
  };

  const handleRestoreConfirm = async () => {
    if (!restoreBackup || !restoreConfirmed) return;
    setRestoring(true);
    try {
      const body: { backupPath: string; confirm: boolean; restoreScope?: string } = {
        backupPath: restoreBackup.path,
        confirm: true,
      };
      if (restoreBackup.scope === "all" && restoreScopeTeamId && restoreScopeTeamId !== "__all__") {
        body.restoreScope = restoreScopeTeamId;
      }
      const res = await fetch("/api/admin/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Restore completed");
        setRestoreBackup(null);
        setRestoreScopeTeamId("__all__");
        setRestoreConfirmed(false);
        refreshAll();
      } else {
        toast.error(data.error || "Restore failed");
      }
    } catch {
      toast.error("Restore failed");
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteBackup) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/backup/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: deleteBackup.path }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Backup deleted");
        setDeleteBackup(null);
        refreshAll();
      } else {
        toast.error(data.error || "Delete failed");
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const resetRestoreDialog = () => {
    setRestoreBackup(null);
    setRestoreScopeTeamId("__all__");
    setRestoreConfirmed(false);
  };

  const scopeLabel = (s: string) => (s === "all" ? "All accounts" : teams.find((t) => t.team_id === s)?.business_name ?? s);
  const logTypeLabel = (type: string) =>
    type === "backup" ? "Backup" : type === "restore" ? "Restore" : type === "backup_deleted" ? "Deleted" : type;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <HardDrive className="h-7 w-7 text-blue-600" />
          Database & storage backup
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Backup and restore database tables and storage from machine, business plan, team, and onboarding data.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "backup" | "logs")} className="w-full">
        <TabsList className="border border-gray-200 bg-gray-50">
          <TabsTrigger value="backup" className="data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-gray-200">
            Backup
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-gray-200">
            Activity logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backup" className="mt-4 space-y-6">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-base">Create backup</CardTitle>
              <CardDescription>
                Choose to backup all accounts or a single account. Backups are stored in the database-backups bucket.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <div className="w-full sm:w-48">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Scope</label>
                  <Select value={scope} onValueChange={(v) => setScope(v as "all" | "single")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All accounts</SelectItem>
                      <SelectItem value="single">Single account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {scope === "single" && (
                  <div className="w-full sm:w-64">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Account</label>
                    <Select value={selectedTeamId} onValueChange={setSelectedTeamId} disabled={loadingTeams}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((t) => (
                          <SelectItem key={t.team_id} value={t.team_id}>
                            {t.business_name || t.team_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button
                  onClick={handleCreateBackup}
                  disabled={creating || (scope === "single" && !selectedTeamId)}
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    "Create backup"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Backups</CardTitle>
                <CardDescription>Download, restore, or delete a backup.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={refreshAll} disabled={loadingBackups}>
                {loadingBackups ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingBackups ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : backups.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">No backups yet. Create one above.</p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date / time</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backups.map((b) => (
                        <TableRow key={b.path}>
                          <TableCell className="font-medium">
                            {new Date(b.exportedAt).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </TableCell>
                          <TableCell>{scopeLabel(b.scope)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(b.path)}
                                className="flex items-center gap-1"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRestoreBackup(b)}
                                className="flex items-center gap-1 text-amber-700 border-amber-200 hover:bg-amber-50"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Restore
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteBackup(b)}
                                className="flex items-center gap-1 text-red-700 border-red-200 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-gray-500">
            To run daily backups, call POST /api/admin/backup with body {`{ "scope": "all" }`} and protect the endpoint
            with a cron secret header (e.g. Vercel Cron or an external scheduler).
          </p>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card className="border border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Backup & restore activity
                </CardTitle>
                <CardDescription>Recent backup, restore, and delete actions.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loadingLogs}>
                {loadingLogs ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">No activity yet.</p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Path</TableHead>
                        <TableHead className="text-right">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm text-gray-600">
                            {new Date(log.created_at).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                log.type === "backup"
                                  ? "text-blue-700 font-medium"
                                  : log.type === "restore"
                                    ? "text-amber-700 font-medium"
                                    : "text-red-700 font-medium"
                              }
                            >
                              {logTypeLabel(log.type)}
                            </span>
                          </TableCell>
                          <TableCell>{scopeLabel(log.scope)}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-gray-500" title={log.backup_path}>
                            {log.backup_path}
                          </TableCell>
                          <TableCell className="text-right text-sm text-gray-500">
                            {log.details?.storage_files != null && `${log.details.storage_files} files`}
                            {log.details?.storage_files_restored != null &&
                              `${log.details.storage_files_restored} files restored`}
                            {log.details?.files_removed != null && `${log.details.files_removed} files removed`}
                            {log.type === "backup" && log.details?.tables && (
                              <span className="ml-1">
                                {Object.values(log.details.tables).reduce((a, b) => a + b, 0)} rows
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!restoreBackup} onOpenChange={(open) => { if (!open) resetRestoreDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Confirm restore
            </DialogTitle>
            <DialogDescription>
              This will overwrite current data with the selected backup. Please read the warning below carefully before proceeding.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="text-sm font-medium text-amber-800">Before you restore, please note:</p>
            <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
              <li>All current data for the selected scope will be replaced with the backup data.</li>
              <li>Any changes made after this backup was created will be lost.</li>
              <li>It is strongly recommended to create a fresh backup before restoring.</li>
              <li>This operation cannot be undone.</li>
            </ul>
          </div>

          {restoreBackup?.scope === "all" && teams.length > 0 && (
            <div className="py-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Restore only this account (optional)</label>
              <Select value={restoreScopeTeamId} onValueChange={setRestoreScopeTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Restore all (full backup)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Restore all (full backup)</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.team_id} value={t.team_id}>
                      {t.business_name || t.team_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Leave as &quot;Restore all&quot; to restore every account from this backup. Pick an account to restore only that
                account&apos;s data.
              </p>
            </div>
          )}

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={restoreConfirmed}
              onChange={(e) => setRestoreConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-gray-700">
              I understand this will overwrite existing data and want to proceed.
            </span>
          </label>

          <DialogFooter>
            <Button variant="outline" onClick={resetRestoreDialog} disabled={restoring}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRestoreConfirm} disabled={restoring || !restoreConfirmed}>
              {restoring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Restoring...
                </>
              ) : (
                "Restore"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteBackup} onOpenChange={(open) => !open && setDeleteBackup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="h-5 w-5" />
              Delete backup
            </DialogTitle>
            <DialogDescription>
              This will permanently remove this backup from storage. This cannot be undone. The deletion will be
              recorded in the activity log.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteBackup(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete backup"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { HardDrive, Download, RotateCcw, RefreshCw, Loader2, AlertTriangle, FileText } from "lucide-react";
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
  type: "backup" | "restore";
  scope: string;
  backup_path: string;
  triggered_by_user_id: string;
  details?: { tables?: Record<string, number>; storage_files?: number; storage_files_restored?: number };
  created_at: string;
}

export default function AdminBackupPage() {
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [scope, setScope] = useState<"all" | "single">("all");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restorePath, setRestorePath] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
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
    const url = `/api/admin/backup?path=${encodeURIComponent(path)}`;
    window.open(url, "_blank");
    toast.success("Download started");
  };

  const handleRestoreConfirm = async () => {
    if (!restorePath) return;
    setRestoring(true);
    try {
      const res = await fetch("/api/admin/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupPath: restorePath, confirm: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Restore completed");
        setRestorePath(null);
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

  const scopeLabel = (s: string) => (s === "all" ? "All accounts" : teams.find((t) => t.team_id === s)?.business_name ?? s);

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
              <Select
                value={scope}
                onValueChange={(v) => setScope(v as "all" | "single")}
              >
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
                <Select
                  value={selectedTeamId}
                  onValueChange={setSelectedTeamId}
                  disabled={loadingTeams}
                >
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
                  Creating…
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
            <CardDescription>Download or restore from a previous backup.</CardDescription>
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
                        <div className="flex justify-end gap-2">
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
                            onClick={() => setRestorePath(b.path)}
                            className="flex items-center gap-1 text-amber-700 border-amber-200 hover:bg-amber-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restore
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

      <Card className="border border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Backup & restore activity
            </CardTitle>
            <CardDescription>Recent backup and restore actions with scope and data counts.</CardDescription>
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
                              : "text-amber-700 font-medium"
                          }
                        >
                          {log.type === "backup" ? "Backup" : "Restore"}
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

      <p className="text-xs text-gray-500">
        To run daily backups, call POST /api/admin/backup with body {`{ "scope": "all" }`} and protect the endpoint
        with a cron secret header (e.g. Vercel Cron or an external scheduler).
      </p>

      <Dialog open={!!restorePath} onOpenChange={(open) => !open && setRestorePath(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Confirm restore
            </DialogTitle>
            <DialogDescription>
              This will overwrite current data for the backup’s scope with the selected backup. This action cannot be
              undone. Only proceed if you are sure.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestorePath(null)} disabled={restoring}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRestoreConfirm}
              disabled={restoring}
            >
              {restoring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Restoring…
                </>
              ) : (
                "Restore"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

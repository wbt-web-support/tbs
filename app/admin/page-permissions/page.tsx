"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Search,
  Save,
  Trash2,
  Users,
  AlertCircle,
  RefreshCw,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getAdminUsers,
  getAvailablePages,
  getPermissionsMatrix,
  updateUserPermissions,
  clearUserPermissions,
  type AdminUser,
  type PageInfo,
} from "./actions";

export default function PagePermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [permissionsMatrix, setPermissionsMatrix] = useState<
    Record<string, string[]>
  >({});
  const [searchTerm, setSearchTerm] = useState("");
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [userToClear, setUserToClear] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, pagesData, matrixData] = await Promise.all([
        getAdminUsers(),
        getAvailablePages(),
        getPermissionsMatrix(),
      ]);

      setAdminUsers(usersData);
      setPages(pagesData);
      setPermissionsMatrix(matrixData);
      setPendingChanges({});
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load page permissions");
    } finally {
      setLoading(false);
    }
  };

  const getUserPermissions = (userId: string): string[] => {
    // Check pending changes first
    if (pendingChanges[userId] !== undefined) {
      return pendingChanges[userId];
    }
    // Then check current permissions
    return permissionsMatrix[userId] || [];
  };

  const hasPermission = (userId: string, pagePath: string): boolean => {
    return getUserPermissions(userId).includes(pagePath);
  };

  const getPageStatus = (pagePath: string): "all" | "none" | "some" => {
    if (adminUsers.length === 0) return "none";
    
    const hasPermissionCount = adminUsers.filter((user) =>
      hasPermission(user.id, pagePath)
    ).length;

    if (hasPermissionCount === 0) return "none";
    if (hasPermissionCount === adminUsers.length) return "all";
    return "some";
  };

  const handlePageToggle = (pagePath: string) => {
    const status = getPageStatus(pagePath);
    const shouldAssign = status !== "all";

    // Update pending changes for all users
    const newPendingChanges: Record<string, string[]> = { ...pendingChanges };

    adminUsers.forEach((user) => {
      const currentPermissions = getUserPermissions(user.id);
      let newPermissions: string[];

      if (shouldAssign) {
        // Add page to all users
        if (!currentPermissions.includes(pagePath)) {
          newPermissions = [...currentPermissions, pagePath].sort();
          newPendingChanges[user.id] = newPermissions;
        }
      } else {
        // Remove page from all users
        if (currentPermissions.includes(pagePath)) {
          newPermissions = currentPermissions.filter((p) => p !== pagePath);
          newPendingChanges[user.id] = newPermissions;
        }
      }
    });

    setPendingChanges(newPendingChanges);
  };

  const handleUserPageToggle = (userId: string, pagePath: string) => {
    const currentPermissions = getUserPermissions(userId);
    const newPermissions = currentPermissions.includes(pagePath)
      ? currentPermissions.filter((p) => p !== pagePath)
      : [...currentPermissions, pagePath].sort();

    setPendingChanges((prev) => ({
      ...prev,
      [userId]: newPermissions,
    }));
  };

  const saveAllChanges = async () => {
    const changes = Object.entries(pendingChanges);
    if (changes.length === 0) {
      toast.info("No changes to save");
      return;
    }

    try {
      setSaving(true);
      let successCount = 0;
      let errorCount = 0;

      for (const [userId, newPermissions] of changes) {
        const result = await updateUserPermissions(userId, newPermissions);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.error(`Failed to update user ${userId}:`, result.error);
        }
      }

      if (errorCount === 0) {
        toast.success(
          `Successfully updated ${successCount} user${successCount !== 1 ? "s" : ""}`
        );
        await fetchData();
      } else {
        toast.error(
          `Updated ${successCount} user(s), but ${errorCount} failed`
        );
        await fetchData();
      }
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleClearUser = async () => {
    if (!userToClear) return;

    try {
      setSaving(true);
      const result = await clearUserPermissions(userToClear);
      if (result.success) {
        toast.success("User permissions cleared");
        await fetchData();
        setShowClearDialog(false);
        setUserToClear(null);
      } else {
        toast.error(result.error || "Failed to clear permissions");
      }
    } catch (error) {
      console.error("Error clearing permissions:", error);
      toast.error("Failed to clear permissions");
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = adminUsers.filter((user) =>
    `${user.full_name} ${user.email} ${user.business_name}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;
  const changedCount = Object.keys(pendingChanges).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Admin Page Permissions
          </h1>
          <p className="text-slate-600 mt-2">
            Manage which dashboard pages are visible to each admin user
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading || saving}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          {hasPendingChanges && (
            <Button
              onClick={saveAllChanges}
              disabled={saving}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Changes ({changedCount})
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Info Card */}
      <Card className="p-5 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <AlertCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 mb-2">How it works:</p>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-700">
              <li>
                Click <strong>"Select All"</strong> or <strong>"Unselect All"</strong> on a page column header to assign or
                remove it from all admin users
              </li>
              <li>
                Use individual checkboxes to customize permissions for specific
                users
              </li>
              <li>
                All changes are stored temporarily - click <strong>"Save Changes"</strong> to apply them
              </li>
              <li>
                Dashboard is always visible to everyone (not shown in this list)
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Search */}
      <Card className="p-4 shadow-sm border-slate-200">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search users by name, email, or business..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          <Badge variant="outline" className="px-4 py-1.5 text-sm font-medium">
            {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </Card>

      {/* Permissions Matrix Table */}
      {filteredUsers.length === 0 ? (
        <Card className="p-12 text-center border-slate-200 shadow-sm">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-600 mb-1">
            {searchTerm
              ? "No users match your search"
              : "No admin users found"}
          </p>
          <p className="text-sm text-gray-500">
            {searchTerm ? "Try a different search term" : "Admin users will appear here"}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-b-2 border-slate-200">
                  <TableHead className="w-[280px] sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                    <div className="flex items-center gap-2 py-2">
                      <Users className="w-4 h-4 text-slate-600" />
                      <span className="font-semibold text-slate-900">Admin User</span>
                    </div>
                  </TableHead>
                  {pages.map((page) => {
                    const status = getPageStatus(page.path);
                    const allSelected = status === "all";
                    const someSelected = status === "some";

                    return (
                      <TableHead
                        key={page.path}
                        className="min-w-[200px] text-center border-r border-slate-200 last:border-r-0"
                      >
                        <div className="flex flex-col items-center gap-3 py-2">
                          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                            {page.section}
                          </div>
                          <div className="flex flex-col items-center gap-2 w-full">
                            <span className="font-semibold text-slate-900 text-sm">{page.name}</span>
                            <Button
                              variant={allSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageToggle(page.path)}
                              disabled={saving}
                              className={
                                allSelected
                                  ? "bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs font-medium shadow-sm"
                                  : "border-slate-300 hover:border-blue-400 hover:bg-blue-50 h-8 text-xs font-medium"
                              }
                            >
                              {allSelected ? (
                                <>
                                  <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                                  Unselect All
                                </>
                              ) : (
                                <>
                                  <Square className="w-3.5 h-3.5 mr-1.5" />
                                  Select All
                                </>
                              )}
                            </Button>
                            {someSelected && (
                              <Badge variant="secondary" className="text-xs font-medium">
                                {adminUsers.filter((u) =>
                                  hasPermission(u.id, page.path)
                                ).length}{" "}
                                / {adminUsers.length}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableHead>
                    );
                  })}
                  <TableHead className="w-[100px] text-center bg-slate-50">
                    <span className="font-semibold text-slate-900">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user, index) => {
                  const userPermissions = getUserPermissions(user.id);
                  const hasChanges = pendingChanges[user.id] !== undefined;
                  const isEven = index % 2 === 0;

                  return (
                    <TableRow 
                      key={user.id} 
                      className={`border-b border-slate-100 ${isEven ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/50 transition-colors`}
                    >
                      <TableCell className="sticky left-0 z-10 font-medium border-r border-slate-200 bg-inherit">
                        <div className="flex flex-col gap-1 py-2">
                          <span className="font-semibold text-slate-900">{user.full_name}</span>
                          <span className="text-xs text-slate-600">{user.email}</span>
                          <span className="text-xs text-slate-500">{user.business_name}</span>
                        </div>
                      </TableCell>
                      {pages.map((page) => {
                        const checked = hasPermission(user.id, page.path);

                        return (
                          <TableCell 
                            key={page.path} 
                            className="text-center border-r border-slate-100 last:border-r-0"
                          >
                            <div className="flex items-center justify-center py-2">
                              <Switch
                                checked={checked}
                                onCheckedChange={() => {
                                  handleUserPageToggle(user.id, page.path);
                                }}
                              />
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUserToClear(user.id);
                            setShowClearDialog(true);
                          }}
                          disabled={
                            saving || userPermissions.length === 0
                          }
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                          title="Clear all permissions"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Clear User Permissions Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Permissions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all page permissions for{" "}
              <strong>
                {adminUsers.find((u) => u.id === userToClear)?.full_name}
              </strong>
              . They will only see the dashboard page. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Clear All Permissions
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

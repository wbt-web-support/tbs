"use client";

import { useState, useEffect, useRef } from "react";
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
  
  // Refs for custom scrollbar
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const customScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [clientWidth, setClientWidth] = useState(0);

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

  // Update scroll dimensions when table content changes
  useEffect(() => {
    const updateScrollDimensions = () => {
      if (tableScrollRef.current) {
        setScrollWidth(tableScrollRef.current.scrollWidth);
        setClientWidth(tableScrollRef.current.clientWidth);
      }
    };

    updateScrollDimensions();
    window.addEventListener('resize', updateScrollDimensions);
    
    // Update dimensions after a short delay to ensure table is rendered
    const timer = setTimeout(updateScrollDimensions, 100);

    return () => {
      window.removeEventListener('resize', updateScrollDimensions);
      clearTimeout(timer);
    };
  }, [filteredUsers, pages]);

  // Sync scroll between table and custom scrollbar
  const handleTableScroll = () => {
    if (tableScrollRef.current && customScrollRef.current) {
      customScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  };

  const handleCustomScroll = () => {
    if (tableScrollRef.current && customScrollRef.current) {
      tableScrollRef.current.scrollLeft = customScrollRef.current.scrollLeft;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">
            Admin Page Permissions
          </h1>
          <p className="text-slate-600 text-base">
            Manage which dashboard pages are visible to each admin user
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading || saving}
            className="border-slate-300 hover:border-slate-400 hover:bg-slate-50 h-10 px-4"
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
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all h-11 px-6 animate-pulse hover:animate-none"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
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


      {/* Search */}
      <Card className="p-5 shadow-md border-slate-300">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Search users by name, email, or business..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 h-11 border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-base"
            />
          </div>
          <Badge 
            variant="outline" 
            className="px-4 py-2 text-sm font-bold border-slate-400 bg-slate-50 text-slate-700"
          >
            {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </Card>

     

      {/* Permissions Matrix Table */}
      {filteredUsers.length === 0 ? (
        <Card className="p-16 text-center border-slate-300 shadow-md">
          <div className="inline-block p-6 rounded-full bg-slate-100 mb-6">
            <Users className="w-20 h-20 text-slate-400 mx-auto" />
          </div>
          <p className="text-xl font-bold text-slate-700 mb-2">
            {searchTerm
              ? "No users match your search"
              : "No admin users found"}
          </p>
          <p className="text-sm text-slate-500">
            {searchTerm ? "Try a different search term" : "Admin users will appear here"}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden border-slate-300 shadow-md">
          <div className="relative">
            <div 
              ref={tableScrollRef}
              onScroll={handleTableScroll}
              className="overflow-auto max-h-[calc(100vh-320px)] always-visible-scrollbar rounded-lg"
            >
              <Table>
                <TableHeader className="bg-gradient-to-r from-slate-100 to-slate-50 sticky top-0 z-20 shadow-sm">
                  <TableRow className="border-b-2 border-slate-300">
                    <TableHead className="w-[250px] min-w-[250px] max-w-[250px] sticky left-0 bg-gradient-to-r from-slate-100 to-slate-50 z-30 border-r-2 border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center gap-2 py-3 px-4">
                        <Users className="w-5 h-5 text-slate-700" />
                        <span className="font-bold text-slate-900 text-sm">Admin User</span>
                      </div>
                    </TableHead>
                    {pages.map((page) => {
                      const status = getPageStatus(page.path);
                      const allSelected = status === "all";
                      const someSelected = status === "some";

                      return (
                        <TableHead
                          key={page.path}
                          className="min-w-[160px] w-[160px] text-center border-r border-slate-200 last:border-r-0"
                        >
                          <div className="flex flex-col items-center gap-2 py-3 px-2">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-200/60 px-2 py-1 rounded-full">
                              {page.section}
                            </div>
                            <div className="flex flex-col items-center gap-2 w-full px-1">
                              <span className="font-bold text-slate-900 text-sm leading-tight text-center min-h-[32px] flex items-center justify-center">{page.name}</span>
                              <Button
                                variant={allSelected ? "default" : "outline"}
                                size="sm"
                                onClick={() => handlePageToggle(page.path)}
                                disabled={saving}
                                className={
                                  allSelected
                                    ? "bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs font-semibold shadow-md px-3 transition-all"
                                    : "border-slate-400 hover:border-blue-500 hover:bg-blue-50 h-8 text-xs font-semibold px-3 transition-all"
                                }
                              >
                                {allSelected ? (
                                  <>
                                    <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                                    <span className="text-xs">All</span>
                                  </>
                                ) : (
                                  <>
                                    <Square className="w-3.5 h-3.5 mr-1.5" />
                                    <span className="text-xs">All</span>
                                  </>
                                )}
                              </Button>
                              {someSelected && (
                                <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300">
                                  {adminUsers.filter((u) =>
                                    hasPermission(u.id, page.path)
                                  ).length}/{adminUsers.length}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableHead>
                      );
                    })}
                    <TableHead className="w-[100px] min-w-[100px] text-center bg-gradient-to-r from-slate-100 to-slate-50 right-0 z-30 border-l-2 border-slate-300 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <span className="font-bold text-slate-900 text-sm">Actions</span>
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
                        className={`
                          border-b border-slate-200 transition-all duration-200
                          ${hasChanges 
                            ? 'bg-amber-50/80 hover:bg-amber-100/80 border-l-4 border-l-amber-400' 
                            : isEven 
                              ? 'bg-white hover:bg-blue-50/40' 
                              : 'bg-slate-50/50 hover:bg-blue-50/60'
                          }
                        `}
                      >
                        <TableCell className={`
                          sticky left-0 z-10 font-medium border-r-2 border-slate-300 
                          min-w-[250px] max-w-[250px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]
                          ${hasChanges 
                            ? 'bg-amber-50/80' 
                            : isEven 
                              ? 'bg-white' 
                              : 'bg-white'
                          }
                        `}>
                          <div className="flex flex-col gap-1 py-2 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{user.full_name}</span>
                              {hasChanges && (
                                <Badge className="bg-amber-400 text-amber-900 text-[10px] px-1.5 py-0 font-semibold">
                                  EDITED
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-slate-600 truncate font-medium">{user.email}</span>
                            <span className="text-xs text-slate-500 truncate">{user.business_name}</span>
                          </div>
                        </TableCell>
                        {pages.map((page) => {
                          const checked = hasPermission(user.id, page.path);

                          return (
                            <TableCell 
                              key={page.path} 
                              className={`
                                text-center border-r border-slate-200 last:border-r-0
                                ${hasChanges ? 'bg-amber-50/40' : ''}
                              `}
                            >
                              <div className="flex items-center justify-center py-3">
                                <Switch
                                  checked={checked}
                                  onCheckedChange={() => {
                                    handleUserPageToggle(user.id, page.path);
                                  }}
                                  className="data-[state=checked]:bg-blue-600"
                                />
                              </div>
                            </TableCell>
                          );
                        })}
                        <TableCell className={`
                          text-center  right-0 z-10 border-l-2 border-slate-300 
                          shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]
                          ${hasChanges 
                            ? 'bg-amber-50/80' 
                            : isEven 
                              ? 'bg-white' 
                              : 'bg-slate-50/50'
                          }
                        `}>
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
                            className="text-red-600 hover:text-red-700 hover:bg-red-100 h-9 w-9 p-0 transition-all"
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
          </div>
        </Card>
      )}

      {/* Custom Horizontal Scrollbar Section */}
      {filteredUsers.length > 0 && scrollWidth > clientWidth && (
        <Card className="overflow-hidden border-slate-300 shadow-lg bg-gradient-to-r from-blue-50 via-slate-50 to-blue-50">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-300 shadow-sm">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="w-5 h-5 text-blue-600" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
                <span className="text-sm font-bold text-slate-900">Horizontal Scroll Control</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="w-5 h-5 text-blue-600" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
              <Badge className="bg-blue-600 text-white border-blue-700 font-bold text-xs shadow-md">
                Scroll Helper
              </Badge>
            </div>
            
            {/* Custom Scrollbar Container with enhanced visibility */}
            <div className="bg-white rounded-lg border-2 border-slate-300 p-3 shadow-inner">
              <div 
                ref={customScrollRef}
                onScroll={handleCustomScroll}
                className="overflow-x-auto overflow-y-hidden always-visible-scrollbar rounded-md bg-slate-100"
                style={{ 
                  height: '50px',
                  minHeight: '50px',
                }}
              >
                <div 
                  className="h-full bg-gradient-to-r from-blue-200 via-indigo-200 to-blue-200 rounded-md"
                  style={{ 
                    width: `${scrollWidth}px`,
                    minHeight: '50px',
                  }}
                >
                  {/* Visual grid to show scrollable area */}
                  <div className="h-full flex items-center justify-center gap-1 px-4">
                    {Array.from({ length: Math.ceil(scrollWidth / 100) }).map((_, i) => (
                      <div 
                        key={i} 
                        className="w-1 h-6 bg-blue-400/30 rounded-full"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 mt-4 text-center font-semibold bg-white/60 py-2 rounded-lg">
              💡 Drag the scrollbar above to navigate horizontally across the permissions table
            </p>
          </div>
        </Card>
      )}

      {/* Clear User Permissions Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-full bg-red-100">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-bold text-slate-900">
                Clear All Permissions?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base text-slate-700 leading-relaxed pt-2">
              This will remove all page permissions for{" "}
              <strong className="text-slate-900 font-bold">
                {adminUsers.find((u) => u.id === userToClear)?.full_name}
              </strong>
              . They will only see the dashboard page.
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-semibold text-red-800">
                  ⚠️ This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-slate-300 hover:bg-slate-100">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearUser}
              className="bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-lg transition-all"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Permissions
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

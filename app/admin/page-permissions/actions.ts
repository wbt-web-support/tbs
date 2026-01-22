"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type AdminUser = {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  business_name: string;
};

export type PageInfo = {
  path: string;
  name: string;
  section: string;
};

export type AdminUserPermissions = {
  id: string;
  admin_user_id: string;
  page_paths: string[];
  created_at: string;
  updated_at: string;
};

/**
 * Get all available dashboard pages from the sidebar navigation
 */
export async function getAvailablePages(): Promise<PageInfo[]> {
  // These match the navigationSections in components/sidebar.tsx
  // Note: Dashboard is always visible and not included here
  const pages: PageInfo[] = [
    { path: "calendar", name: "Calendar", section: "Overview" },
    { path: "team", name: "Team", section: "Overview" },
    { path: "software-tracker", name: "Software Tracker", section: "Overview" },
    { path: "todos", name: "To do's", section: "Overview" },
    { path: "company-overview", name: "Company Overview", section: "Strategy" },
    { path: "business-plan", name: "Business Plan", section: "Strategy" },
    { path: "playbook-planner", name: "Playbooks", section: "Strategy" },
    { path: "growth-machine", name: "Growth Machine", section: "Value Machines" },
    { path: "fulfillment-machine", name: "Fulfilment Machine", section: "Value Machines" },
    { path: "chat", name: "AI Assistant", section: "AI" },
    { path: "integrations", name: "Integrations", section: "Settings" },
  ];
  
  return pages;
}

/**
 * Verify the current user is a super_admin
 */
async function verifySuperAdmin() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("business_info")
    .select("role")
    .eq("user_id", session.user.id)
    .single();

  if (error || !data || data.role !== "super_admin") {
    throw new Error("Unauthorized: Super admin access required");
  }

  return supabase;
}

/**
 * Get all admin users (excluding super_admins)
 */
export async function getAdminUsers(): Promise<AdminUser[]> {
  const supabase = await verifySuperAdmin();

  const { data, error } = await supabase
    .from("business_info")
    .select("id, user_id, email, full_name, business_name")
    .eq("role", "admin")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching admin users:", error);
    throw new Error("Failed to fetch admin users");
  }

  return data || [];
}

/**
 * Check if table has new structure (page_paths) or old structure (page_path)
 */
async function detectTableStructure(supabase: any): Promise<"new" | "old"> {
  // Try to select page_paths - if it fails, it's the old structure
  const { error } = await supabase
    .from("admin_page_permissions")
    .select("page_paths")
    .limit(1);

  if (error && error.code === "42703") {
    // Column doesn't exist, it's the old structure
    return "old";
  }
  return "new";
}

/**
 * Get all admin page permissions (one row per user with JSON array of pages)
 */
export async function getAllAdminPermissions(): Promise<AdminUserPermissions[]> {
  const supabase = await verifySuperAdmin();

  const structure = await detectTableStructure(supabase);

  if (structure === "old") {
    // Old structure: one row per page, need to group
    const { data, error } = await supabase
      .from("admin_page_permissions")
      .select("id, admin_user_id, page_path, created_at, updated_at");

    if (error) {
      console.error("Error fetching admin page permissions:", error);
      throw new Error("Failed to fetch admin page permissions");
    }

    // Group by admin_user_id
    const grouped = new Map<string, AdminUserPermissions>();
    (data || []).forEach((item: any) => {
      if (!grouped.has(item.admin_user_id)) {
        grouped.set(item.admin_user_id, {
          id: item.id,
          admin_user_id: item.admin_user_id,
          page_paths: [],
          created_at: item.created_at,
          updated_at: item.updated_at,
        });
      }
      const perm = grouped.get(item.admin_user_id)!;
      if (!perm.page_paths.includes(item.page_path)) {
        perm.page_paths.push(item.page_path);
      }
    });

    return Array.from(grouped.values()).map((p) => ({
      ...p,
      page_paths: p.page_paths.sort(),
    }));
  } else {
    // New structure: one row per user with JSON array
    const { data, error } = await supabase
      .from("admin_page_permissions")
      .select("*");

    if (error) {
      console.error("Error fetching admin page permissions:", error);
      throw new Error("Failed to fetch admin page permissions");
    }

    // Transform page_paths from JSONB to string array
    return (data || []).map((item) => ({
      id: item.id,
      admin_user_id: item.admin_user_id,
      page_paths: Array.isArray(item.page_paths) ? item.page_paths : [],
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }
}

/**
 * Get page permissions for a specific admin user
 */
export async function getAdminUserPermissions(adminUserId: string): Promise<string[]> {
  const supabase = await verifySuperAdmin();

  const structure = await detectTableStructure(supabase);

  if (structure === "old") {
    // Old structure: query individual rows
    const { data, error } = await supabase
      .from("admin_page_permissions")
      .select("page_path")
      .eq("admin_user_id", adminUserId);

    if (error) {
      console.error("Error fetching user permissions:", error);
      throw new Error("Failed to fetch user permissions");
    }

    return (data || []).map((p: any) => p.page_path).sort();
  } else {
    // New structure: single row with JSON array
    const { data, error } = await supabase
      .from("admin_page_permissions")
      .select("page_paths")
      .eq("admin_user_id", adminUserId)
      .single();

    if (error) {
      // If no record exists, return empty array
      if (error.code === "PGRST116") {
        return [];
      }
      console.error("Error fetching user permissions:", error);
      throw new Error("Failed to fetch user permissions");
    }

    return Array.isArray(data?.page_paths) ? data.page_paths : [];
  }
}

/**
 * Get permissions matrix (all users with their permissions)
 */
export async function getPermissionsMatrix(): Promise<Record<string, string[]>> {
  const permissions = await getAllAdminPermissions();
  const matrix: Record<string, string[]> = {};

  permissions.forEach((perm) => {
    matrix[perm.admin_user_id] = perm.page_paths;
  });

  return matrix;
}

/**
 * Update permissions for a single user
 */
export async function updateUserPermissions(
  adminUserId: string,
  pagePaths: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await verifySuperAdmin();

  try {
    const structure = await detectTableStructure(supabase);
    const uniquePaths = Array.from(new Set(pagePaths)).sort();

    if (structure === "old") {
      // Old structure: delete existing and insert new ones
      const { error: deleteError } = await supabase
        .from("admin_page_permissions")
        .delete()
        .eq("admin_user_id", adminUserId);

      if (deleteError) {
        throw new Error(`Failed to clear existing permissions: ${deleteError.message}`);
      }

      if (uniquePaths.length > 0) {
        const inserts = uniquePaths.map((path) => ({
          admin_user_id: adminUserId,
          page_path: path,
        }));

        const { error: insertError } = await supabase
          .from("admin_page_permissions")
          .insert(inserts);

        if (insertError) {
          throw new Error(`Failed to insert permissions: ${insertError.message}`);
        }
      }
    } else {
      // New structure: upsert with JSON array
      const { error } = await supabase
        .from("admin_page_permissions")
        .upsert(
          {
            admin_user_id: adminUserId,
            page_paths: uniquePaths as any, // Cast to any for JSONB
          },
          {
            onConflict: "admin_user_id",
          }
        );

      if (error) {
        throw new Error(`Failed to update user permissions: ${error.message}`);
      }
    }

    revalidatePath("/admin/page-permissions");
    return { success: true };
  } catch (error) {
    console.error("Error in updateUserPermissions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Assign a page to all admin users
 */
export async function assignPageToAllAdmins(
  pagePath: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await verifySuperAdmin();

  try {
    // Get all admin users and their current permissions
    const { data: adminUsers, error: fetchError } = await supabase
      .from("business_info")
      .select("id")
      .eq("role", "admin");

    if (fetchError) {
      console.error("Error fetching admin users:", fetchError);
      throw new Error(`Failed to fetch admin users: ${fetchError.message}`);
    }

    if (!adminUsers || adminUsers.length === 0) {
      return { success: true }; // No admins to assign to
    }

    const adminUserIds = adminUsers.map((u) => u.id);

    // Detect table structure
    const structure = await detectTableStructure(supabase);
    const permissionsMap = new Map<string, string[]>();

    if (structure === "old") {
      // Old structure: fetch individual rows and group
      const { data: existingPermissions, error: fetchPermsError } = await supabase
        .from("admin_page_permissions")
        .select("admin_user_id, page_path")
        .in("admin_user_id", adminUserIds);

      if (fetchPermsError) {
        console.error("Error fetching existing permissions:", fetchPermsError);
        throw new Error(`Failed to fetch existing permissions: ${fetchPermsError.message}`);
      }

      if (existingPermissions) {
        existingPermissions.forEach((p: any) => {
          if (!permissionsMap.has(p.admin_user_id)) {
            permissionsMap.set(p.admin_user_id, []);
          }
          const paths = permissionsMap.get(p.admin_user_id)!;
          if (!paths.includes(p.page_path)) {
            paths.push(p.page_path);
          }
        });
      }
    } else {
      // New structure: fetch with JSON array
      const { data: existingPermissions, error: fetchPermsError } = await supabase
        .from("admin_page_permissions")
        .select("admin_user_id, page_paths")
        .in("admin_user_id", adminUserIds);

      if (fetchPermsError) {
        console.error("Error fetching existing permissions:", fetchPermsError);
        throw new Error(`Failed to fetch existing permissions: ${fetchPermsError.message}`);
      }

      if (existingPermissions) {
        existingPermissions.forEach((p) => {
          const paths = Array.isArray(p.page_paths) ? p.page_paths : [];
          permissionsMap.set(p.admin_user_id, paths);
        });
      }
    }

    // Prepare upsert data based on structure
    if (structure === "old") {
      // Old structure: insert individual rows for each user that doesn't have this page
      const inserts = [];
      for (const userId of adminUserIds) {
        const currentPaths = permissionsMap.get(userId) || [];
        if (!currentPaths.includes(pagePath)) {
          inserts.push({
            admin_user_id: userId,
            page_path: pagePath,
          });
        }
      }

      if (inserts.length > 0) {
        const { error: insertError } = await supabase
          .from("admin_page_permissions")
          .insert(inserts);

        if (insertError) {
          console.error("Error inserting permissions:", insertError);
          throw new Error(`Failed to assign page to all admins: ${insertError.message}`);
        }
      }

      revalidatePath("/admin/page-permissions");
      return { success: true };
    }

    // New structure: use JSON array
    const updates = adminUserIds.map((userId) => {
      const currentPaths = permissionsMap.get(userId) || [];
      const newPaths = currentPaths.includes(pagePath)
        ? currentPaths
        : [...currentPaths, pagePath].sort();
      return {
        admin_user_id: userId,
        page_paths: newPaths as any, // Cast to any for JSONB
      };
    });

    // Use upsert with the correct conflict resolution
    // The unique constraint is on admin_user_id
    let finalError = null;
    
    // Method 1: Try with explicit constraint name
    const { error: error1 } = await supabase
      .from("admin_page_permissions")
      .upsert(updates, {
        onConflict: "admin_user_id",
      });
    
    if (!error1) {
      // Success with method 1
      finalError = null;
    } else {
      console.warn("Method 1 failed, trying method 2:", error1.message);
      
      // Method 2: Try without specifying conflict column
      const { error: error2 } = await supabase
        .from("admin_page_permissions")
        .upsert(updates);
      
      if (!error2) {
        // Success with method 2
        finalError = null;
      } else {
        console.warn("Method 2 failed, trying fallback method:", error2.message);
        
        // Method 3: Try individual updates/inserts as fallback
        let fallbackError = null;
        for (const update of updates) {
          const { data: existing, error: checkError } = await supabase
            .from("admin_page_permissions")
            .select("admin_user_id")
            .eq("admin_user_id", update.admin_user_id)
            .maybeSingle();
          
          if (checkError && checkError.code !== "PGRST116") {
            fallbackError = checkError;
            break;
          }
          
          if (!existing) {
            // Record doesn't exist, insert
            const { error: insertError } = await supabase
              .from("admin_page_permissions")
              .insert(update);
            if (insertError) {
              fallbackError = insertError;
              break;
            }
          } else {
            // Record exists, update
            const { error: updateError } = await supabase
              .from("admin_page_permissions")
              .update({ page_paths: update.page_paths })
              .eq("admin_user_id", update.admin_user_id);
            if (updateError) {
              fallbackError = updateError;
              break;
            }
          }
        }
        
        if (fallbackError) {
          finalError = fallbackError;
        }
      }
    }

    if (finalError) {
      console.error("Error upserting permissions:", finalError);
      console.error("Upsert data sample:", JSON.stringify(updates.slice(0, 2), null, 2));
      throw new Error(`Failed to assign page to all admins: ${finalError.message || finalError.code || 'Unknown error'}`);
    }

    revalidatePath("/admin/page-permissions");
    return { success: true };
  } catch (error) {
    console.error("Error in assignPageToAllAdmins:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Remove a page from all admin users
 */
export async function removePageFromAllAdmins(
  pagePath: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await verifySuperAdmin();

  try {
    const structure = await detectTableStructure(supabase);

    if (structure === "old") {
      // Old structure: just delete rows matching the page_path
      const { error: deleteError } = await supabase
        .from("admin_page_permissions")
        .delete()
        .eq("page_path", pagePath);

      if (deleteError) {
        throw new Error(`Failed to remove page: ${deleteError.message}`);
      }
    } else {
      // New structure: update JSON arrays
      const { data: existingPermissions, error: fetchError } = await supabase
        .from("admin_page_permissions")
        .select("admin_user_id, page_paths");

      if (fetchError) {
        throw new Error("Failed to fetch existing permissions");
      }

      if (!existingPermissions || existingPermissions.length === 0) {
        return { success: true }; // Nothing to remove
      }

      // Remove page from each user's permissions
      const updates = existingPermissions
        .map((p) => {
          const paths = Array.isArray(p.page_paths) ? p.page_paths : [];
          const newPaths = paths.filter((path) => path !== pagePath);
          return {
            admin_user_id: p.admin_user_id,
            page_paths: newPaths,
          };
        })
        .filter((u) => u.page_paths.length > 0); // Only keep users with remaining permissions

      if (updates.length > 0) {
        const { error: updateError } = await supabase
          .from("admin_page_permissions")
          .upsert(updates, {
            onConflict: "admin_user_id",
          });

        if (updateError) {
          throw new Error("Failed to update permissions");
        }
      }

      // Delete records that have no permissions left
      const usersToDelete = existingPermissions
        .map((p) => {
          const paths = Array.isArray(p.page_paths) ? p.page_paths : [];
          const newPaths = paths.filter((path) => path !== pagePath);
          if (newPaths.length === 0) {
            return p.admin_user_id;
          }
          return null;
        })
        .filter((id): id is string => id !== null);

      if (usersToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from("admin_page_permissions")
          .delete()
          .in("admin_user_id", usersToDelete);

        if (deleteError) {
          console.error("Error deleting empty permission records:", deleteError);
          // Non-critical error, continue
        }
      }
    }

    revalidatePath("/admin/page-permissions");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Clear all permissions for a user
 */
export async function clearUserPermissions(
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await verifySuperAdmin();

  try {
    const { error } = await supabase
      .from("admin_page_permissions")
      .delete()
      .eq("admin_user_id", adminUserId);

    if (error) {
      console.error("Error clearing user permissions:", error);
      throw new Error("Failed to clear user permissions");
    }

    revalidatePath("/admin/page-permissions");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

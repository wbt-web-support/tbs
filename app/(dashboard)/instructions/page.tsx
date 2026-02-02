"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, ExternalLink, Edit2, FileText, Info, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { InstructionModal } from "./instruction-modal";

interface Instruction {
  id: string;
  user_id: string;
  title: string;
  content: string;
  content_type: string;
  url?: string | null;
  extraction_metadata?: {
    extracted_text?: string;
    file_name?: string;
    file_size?: number;
    extraction_date?: string;
    loom_metadata?: {
      thumbnailUrl?: string;
      views?: number;
      createdAt?: string;
      owner?: string;
      duration_formatted?: string;
    };
  } | null;
  created_at: string;
  updated_at: string;
}

interface UserInfo {
  user_id: string;
  full_name: string;
  email: string;
}

export default function InstructionsPage() {
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userInfoMap, setUserInfoMap] = useState<Record<string, UserInfo>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInstruction, setEditingInstruction] = useState<Instruction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchUserAndInstructions();
  }, []);

  const fetchUserAndInstructions = async () => {
    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) {
        setLoading(false);
        return;
      }

      setCurrentUserId(effectiveUserId);

      // Check if user is super admin
      const { data: businessInfo } = await supabase
        .from('business_info')
        .select('role')
        .eq('user_id', effectiveUserId)
        .single();

      const isSuperAdminUser = businessInfo?.role === 'super_admin';
      setIsSuperAdmin(isSuperAdminUser);

      // Fetch instructions
      let query = supabase
        .from("business_owner_instructions")
        .select("*")
        .order("created_at", { ascending: false });

      // If not super admin, only fetch own instructions
      if (!isSuperAdminUser) {
        query = query.eq("user_id", effectiveUserId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setInstructions(data || []);

      // If super admin, fetch user info for all instructions
      if (isSuperAdminUser && data && data.length > 0) {
        const userIds = Array.from(new Set(data.map((inst: Instruction) => inst.user_id)));
        const { data: usersInfo } = await supabase
          .from('business_info')
          .select('user_id, full_name, email')
          .in('user_id', userIds);

        if (usersInfo) {
          const userMap: Record<string, UserInfo> = {};
          usersInfo.forEach((user: any) => {
            userMap[user.user_id] = {
              user_id: user.user_id,
              full_name: user.full_name,
              email: user.email,
            };
          });
          setUserInfoMap(userMap);
        }
      }
    } catch (error) {
      console.error("Error fetching instructions:", error);
      toast.error("Failed to load instructions");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this instruction?")) {
      return;
    }

    try {
      setDeletingId(id);
      const { error } = await supabase
        .from("business_owner_instructions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setInstructions(prev => prev.filter(inst => inst.id !== id));
      toast.success("Instruction deleted successfully");
    } catch (error) {
      console.error("Error deleting instruction:", error);
      toast.error("Failed to delete instruction");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (instruction: Instruction) => {
    setEditingInstruction(instruction);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingInstruction(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingInstruction(null);
    fetchUserAndInstructions();
  };

  return (
    <div className="max-w-[1600px] mx-auto py-0 px-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-1">Instructions</h1>
          <p className="text-muted-foreground">
            Manage your instructions and knowledge base
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
              {instructions.length} Total
            </div>
          </div>
          <Button 
            onClick={handleAdd}
            className="font-medium bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Instruction
          </Button>
        </div>
      </div>
      
      <Card className="border-neutral-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Instructions</CardTitle>
              <CardDescription className="mt-1.5">
                {instructions.length} total instructions
              </CardDescription>
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mr-1.5" />
              Instructions are ordered by creation date
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : (
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead>
                  <tr className="border-b">
                    {isSuperAdmin && (
                      <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Owner</th>
                    )}
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Title</th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Type</th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Source</th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Content</th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Created</th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Updated</th>
                    <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {instructions.map((instruction) => {
                    const owner = isSuperAdmin ? userInfoMap[instruction.user_id] : null;
                    return (
                      <tr key={instruction.id} className="border-b hover:bg-muted/30 transition-colors">
                        {isSuperAdmin && (
                          <td className="p-4 align-middle">
                            {owner ? (
                              <div className="text-xs">
                                <div className="font-medium">{owner.full_name}</div>
                                <div className="text-muted-foreground">{owner.email}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                        )}
                        <td className="p-4 align-middle font-medium">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[200px]">{instruction.title}</span>
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-normal bg-background">
                            {instruction.content_type}
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          {instruction.content_type === 'text' ? (
                            <span className="text-xs text-muted-foreground">Custom Text</span>
                          ) : instruction.url ? (
                            <a href={instruction.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 hover:underline text-xs flex items-center">
                              <ExternalLink className="h-3 w-3 mr-1" />View Source
                            </a>
                          ) : instruction.extraction_metadata?.file_name ? (
                            <span className="text-xs text-muted-foreground truncate max-w-[150px] inline-block">
                              {instruction.extraction_metadata.file_name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-4 align-middle">
                          <div className="max-w-[200px]">
                            <p className="text-xs line-clamp-1 text-muted-foreground">{instruction.content}</p>
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(instruction.created_at), 'MMM d, yyyy')}
                          </span>
                        </td>
                        <td className="p-4 align-middle hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(instruction.updated_at), 'MMM d, yyyy')}
                          </span>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-xs"
                              onClick={() => handleEdit(instruction)}
                            >
                              <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(instruction.id)}
                              disabled={deletingId === instruction.id}
                            >
                              {deletingId === instruction.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!instructions.length && (
                    <tr>
                      <td colSpan={isSuperAdmin ? 8 : 7} className="py-10 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center">
                          <FileText className="h-10 w-10 mb-4 text-muted-foreground/50" />
                          <p>No instructions found</p>
                          <p className="text-xs mt-1">Click "Add Instruction" to create your first instruction</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <InstructionModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        instruction={editingInstruction}
        currentUserId={currentUserId}
      />
    </div>
  );
}

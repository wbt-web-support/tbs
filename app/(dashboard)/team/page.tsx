"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Users, MoreHorizontal, Trash2, Pencil, BookOpen, AlertCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamMemberIds } from "@/utils/supabase/teams";
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Set to true to show Playbooks Owned column (hidden for now, enable later)
const SHOW_PLAYBOOKS = false;
import { deleteTeamMember } from "./actions";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import AddUserDialog from './add-user-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrgChart } from "./org-chart";

// --- New Type Definitions for Relational Data ---

type Department = {
  id: string;
  name: string;
} | null;

type Playbook = {
  id: string;
  playbookname: string;
} | null;

type PlaybookAssignment = {
  assignment_type: 'Owner' | 'Related';
  playbooks: Playbook;
};

type TeamMember = {
  id: string;
  full_name: string;
  job_title: string;
  critical_accountabilities: { value: string }[];
  team_id: string;
  role: string;
  user_id: string;
  profile_picture_url?: string; // <-- add this
  
  // Relational fields
  manager_id: string | null;
  department_id: string | null;
  
  // Processed, nested data
  department: Department;
  manager: TeamMember | null;
  direct_reports: TeamMember[];
  playbooks_owned: Playbook[];
  playbooks_related: Playbook[];
};

export default function ChainOfCommandPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchTeamDirectoryData();
  }, []);

  useEffect(() => {
    const fetchCompanyName = async () => {
      try {
        const effectiveUserId = await getEffectiveUserId();
        if (!effectiveUserId) return;
        const { data } = await supabase
          .from("company_onboarding")
          .select("onboarding_data")
          .eq("user_id", effectiveUserId)
          .maybeSingle();
        const name = (data?.onboarding_data as any)?.company_name_official_registered;
        if (name) setCompanyName(name);
      } catch {
        // ignore
      }
    };
    fetchCompanyName();
  }, [supabase]);

  const fetchTeamDirectoryData = async () => {
    try {
      setLoading(true);
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) throw new Error("No effective user ID");
      setLoggedInUserId(effectiveUserId);

      const teamMemberIds = await getTeamMemberIds(supabase, effectiveUserId);

      // Fetch all business_info records for the team, with related departments and playbook assignments
      const { data: usersData, error } = await supabase
        .from("business_info")
        .select(`
          id,
          full_name,
          job_title,
          critical_accountabilities,
          team_id,
          role,
          user_id,
          profile_picture_url,
          manager_id,
          department_id,
          department:departments(id, name),
          playbook_assignments(
            assignment_type,
            playbooks(id, playbookname)
          )
        `)
        .in("user_id", teamMemberIds);

      if (error) throw error;
      if (!usersData) return;
      
      // Process the fetched data to build the hierarchy
      const usersMap = new Map<string, TeamMember>();
      
      // Initialize each user in the map
      usersData.forEach((u: any) => {
        usersMap.set(u.id, {
          ...u,
          manager: null,
          direct_reports: [],
          playbooks_owned: u.playbook_assignments
            .filter((pa: any) => pa.assignment_type === 'Owner' && pa.playbooks)
            .map((pa: any) => pa.playbooks),
          playbooks_related: u.playbook_assignments
            .filter((pa: any) => pa.assignment_type === 'Related' && pa.playbooks)
            .map((pa: any) => pa.playbooks),
        });
      });

      // Link managers and direct reports
      usersMap.forEach(member => {
        if (member.manager_id) {
          const manager = usersMap.get(member.manager_id);
          if (manager) {
            member.manager = manager;
            manager.direct_reports.push(member);
          }
        }
      });

      setTeamMembers(Array.from(usersMap.values()));

    } catch (error) {
      console.error("Error fetching team data:", error);
    } finally {
      setLoading(false);
    }
  };

  /** Always return a single letter for avatar fallback (initial or ?) */
  const getInitial = (fullName: string | undefined, jobTitle?: string) => {
    const fromName = fullName?.trim()?.[0];
    if (fromName) return fromName.toUpperCase();
    const fromTitle = jobTitle?.trim()?.[0];
    if (fromTitle) return fromTitle.toUpperCase();
    return "?";
  };

  const getDepartmentColor = (departmentName: string | undefined) => {
    if (!departmentName) return "bg-gray-200 text-gray-800";
  
    const colors = [
      "bg-blue-600", "bg-green-600", "bg-purple-600", 
      "bg-red-600", "bg-yellow-600", "bg-indigo-600", "bg-pink-600"
    ];
    
    // Simple hash function to get a consistent color for a department name
    const hash = departmentName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const handleDelete = async (member: TeamMember) => {
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!memberToDelete) return;
    
    setIsDeleting(true);
    
    // Show loading toast
    const loadingToast = toast.loading(`Deleting ${memberToDelete.full_name} and all related data...`);
    
    const result = await deleteTeamMember(memberToDelete.id);

    // Dismiss loading toast
    toast.dismiss(loadingToast);

    if (result.success) {
      toast.success(`${memberToDelete.full_name} and all related data deleted successfully.`);
      fetchTeamDirectoryData(); // Refresh the data
    } else {
      toast.error(`Failed to delete team member: ${result.error}`);
    }

    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setMemberToDelete(null);
  };

  return (
    <div className="max-w-full mx-auto">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="md:text-3xl text-2xl font-medium text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-1">
            An overview of your organisation's structure, roles, and responsibilities.
          </p>
        </div>
        <Button 
          onClick={() => setAddUserDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Team Member
        </Button>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
      ) : (
        <Tabs defaultValue="table" className="w-full">
          <TabsList className="mb-4 bg-gray-100 border border-gray-200 p-1">
            <TabsTrigger value="table" className="data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-gray-200">
              Table
            </TabsTrigger>
            <TabsTrigger value="chart" className="data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-gray-200">
              Org Chart
            </TabsTrigger>
          </TabsList>
          <TabsContent value="table" className="mt-0">
        <Card className="overflow-hidden border border-gray-200 bg-white">
          <div className="overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow className="border-b border-gray-100 bg-gray-50/50">
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Job Title</TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Team</TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[20%] border-l">Critical Accountabilities</TableHead>
                    {SHOW_PLAYBOOKS && (
                      <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Playbooks Owned</TableHead>
                    )}
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Direct Reports</TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Manager</TableHead>
                    <TableHead className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                 <TableBody className="bg-white">
                  {teamMembers.map((member) => (
                    <TableRow key={member.id} className="border-b border-gray-100 hover:bg-gray-50/30">
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            {member.profile_picture_url ? (
                              <AvatarImage src={member.profile_picture_url} alt={member.full_name} />
                            ) : null}
                            <AvatarFallback>{getInitial(member.full_name, member.job_title)}</AvatarFallback>
                          </Avatar>
                          <span>{member.full_name}</span>
                        </div>
                      </TableCell>
                       <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 border-l">{member.job_title || '—'}</TableCell>
                       <TableCell className="px-6 py-4 whitespace-nowrap text-sm border-l">
                        {member.department?.name && <Badge className={`${getDepartmentColor(member.department.name)} hover:bg-opacity-80 text-white`}>{member.department.name}</Badge>}
                       </TableCell>
                       <TableCell className="px-6 py-4 whitespace-normal text-sm text-gray-600 border-l max-w-[300px]">
                         {member.critical_accountabilities && member.critical_accountabilities.length > 0 ? (
                           <Popover>
                             <PopoverTrigger asChild>
                               <button 
                                 type="button"
                                 className="text-left cursor-pointer hover:text-blue-600 transition-colors w-full"
                               >
                                 <ul className="list-disc list-inside space-y-0.5">
                                   {member.critical_accountabilities.slice(0, 2).map((cab, i) => (
                                     <li key={i} className="line-clamp-1">{cab.value}</li>
                                   ))}
                                 </ul>
                                 {member.critical_accountabilities.length > 2 && (
                                   <span className="text-xs text-blue-600 hover:underline mt-1 block font-medium">
                                     +{member.critical_accountabilities.length - 2} more (click to view all)
                                   </span>
                                 )}
                               </button>
                             </PopoverTrigger>
                             <PopoverContent 
                               side="right" 
                               className="max-w-sm p-4"
                               sideOffset={5}
                             >
                               <div className="space-y-2">
                                 <h4 className="font-semibold text-sm mb-2">Critical Accountabilities</h4>
                                 <ul className="list-disc list-inside space-y-1.5">
                                   {member.critical_accountabilities.map((cab, i) => (
                                     <li key={i} className="text-sm text-gray-700">{cab.value}</li>
                                   ))}
                                 </ul>
                               </div>
                             </PopoverContent>
                           </Popover>
                         ) : (
                           <span className="text-gray-400">—</span>
                         )}
                      </TableCell>
                      {SHOW_PLAYBOOKS && (
                        <TableCell className="px-6 py-4 whitespace-nowrap text-sm border-l">
                          <div className="flex flex-col gap-1.5">
                            {member.playbooks_owned?.map((p) => (
                              <Link href={`/playbook-planner?playbook=${p?.id}`} key={p?.id} className="text-blue-600 hover:underline flex items-center gap-2 group">
                                <BookOpen className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                                <span className="truncate max-w-[150px]">{p?.playbookname}</span>
                              </Link>
                            ))}
                          </div>
                        </TableCell>
                      )}
                       <TableCell className="px-6 py-4 whitespace-nowrap text-sm border-l">
                         <div className="flex flex-col gap-1.5">
                          {member.direct_reports?.map((dr) => (
                            <Link href={`#${dr.id}`} key={dr.id} className="text-blue-600 hover:underline flex items-center gap-2">
                              <Avatar className="h-7 w-7 flex-shrink-0">
                                {dr.profile_picture_url ? (
                                  <AvatarImage src={dr.profile_picture_url} alt={dr.full_name} />
                                ) : null}
                                <AvatarFallback>{getInitial(dr.full_name, dr.job_title)}</AvatarFallback>
                              </Avatar>
                              {dr.full_name}
                            </Link>
                            ))}
                          </div>
                       </TableCell>
                       <TableCell className="px-6 py-4 whitespace-nowrap text-sm border-l">
                        {member.manager && (
                          <Link href={`#${member.manager.id}`} className="text-blue-600 hover:underline flex items-center gap-2">
                            <Avatar className="h-7 w-7 flex-shrink-0">
                              {member.manager.profile_picture_url ? (
                                <AvatarImage src={member.manager.profile_picture_url} alt={member.manager.full_name} />
                              ) : null}
                              <AvatarFallback>{getInitial(member.manager.full_name, member.manager.job_title)}</AvatarFallback>
                            </Avatar>
                            {member.manager.full_name}
                          </Link>
                        )}
                      </TableCell>
                       <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-right border-l">

                        <div className="flex items-center gap-2 justify-center"> 
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-gray-500 hover:text-gray-800">
                              <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/invite?edit=${member.id}`} className="flex items-center cursor-pointer">
                                <Pencil className="mr-2 h-4 w-4" />
                                <span>Edit</span>
                              </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                              onClick={() => handleDelete(member)} 
                              className="flex items-center cursor-pointer text-red-600 focus:text-red-600"
                              disabled={member.role === 'admin' || member.user_id === loggedInUserId}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
      </Card>
          </TabsContent>
          <TabsContent value="chart" className="mt-0">
            <Card className="overflow-hidden border border-gray-200 bg-white">
              <OrgChart members={teamMembers} companyName={companyName || undefined} />
            </Card>
          </TabsContent>
        </Tabs>
      )}
      
      <AddUserDialog 
        open={addUserDialogOpen}
        onOpenChange={setAddUserDialogOpen}
        onUserAdded={fetchTeamDirectoryData}
        onEditUser={(userId) => {
          window.location.href = `/invite?edit=${userId}`
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Delete Team Member
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p className="font-medium text-red-600 pt-2">
                Are you sure you want to delete {memberToDelete?.full_name}?
              </p>
              <p className="text-sm font-medium text-red-600">
                This action cannot be undone and will permanently delete:
              </p>
              
              <p className="text-xs text-muted-foreground mt-3">
                Note: The user will be completely removed from the system including their authentication account.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteDialogOpen(false);
                setMemberToDelete(null);
              }} 
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete} 
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Team Member"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
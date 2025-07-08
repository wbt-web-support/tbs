"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Pencil, Trash2, MoreHorizontal, User, Calendar, Target } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamMemberIds } from "@/utils/supabase/teams";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

// Type definitions
type Owner = {
  id: string;
  full_name: string;
  profile_picture_url?: string;
};

type Department = {
  id: string;
  name: string;
};

type Playbook = {
  id: string;
  playbookname: string;
};

type KeyInitiative = {
  id: string;
  name: string;
  status: "Backlog" | "In Progress" | "On Track" | "Behind" | "Completed";
  owner_id: string | null;
  stakeholders: string[];
  due_date: string | null;
  results: string | null;
  associated_playbook_id: string | null;
  team_id: string;
  created_at: string;
  updated_at: string;
  
  // Relational data
  owner: Owner | null;
  departments: Department[];
  playbook: Playbook | null;
};

type KeyInitiativeFormData = {
  name: string;
  status: "Backlog" | "In Progress" | "On Track" | "Behind" | "Completed";
  owner_id: string | null;
  stakeholders: string[];
  due_date: string | null;
  results: string | null;
  associated_playbook_id: string | null;
  department_ids: string[];
};

export default function KeyInitiativesPage() {
  const [initiatives, setInitiatives] = useState<KeyInitiative[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentInitiative, setCurrentInitiative] = useState<KeyInitiative | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [stakeholderInput, setStakeholderInput] = useState("");
  
  const [formData, setFormData] = useState<KeyInitiativeFormData>({
    name: "",
    status: "Backlog",
    owner_id: null,
    stakeholders: [],
    due_date: null,
    results: null,
    associated_playbook_id: null,
    department_ids: [],
  });

  const supabase = createClient();

  useEffect(() => {
    fetchInitiatives();
    fetchDropdownData();
  }, []);

  const fetchInitiatives = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const teamMemberIds = await getTeamMemberIds(supabase, user.id);
      
      // Get current user's team_id
      const { data: userInfo } = await supabase
        .from("business_info")
        .select("team_id")
        .eq("user_id", user.id)
        .single();
      
      if (userInfo) {
        setTeamId(userInfo.team_id);
      }

      // Fetch key initiatives with related data
      const { data: initiativesData, error } = await supabase
        .from("key_initiatives")
        .select(`
          *,
          owner:business_info(id, full_name, profile_picture_url),
          playbook:playbooks(id, playbookname),
          key_initiative_departments(
            departments(id, name)
          )
        `)
        .eq("team_id", userInfo?.team_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const processedInitiatives = initiativesData?.map(initiative => ({
        ...initiative,
        departments: initiative.key_initiative_departments?.map((kid: any) => kid.departments) || [],
        key_initiative_departments: undefined, // Remove this from the final object
      })) || [];

      setInitiatives(processedInitiatives);
    } catch (error) {
      console.error("Error fetching initiatives:", error);
      toast.error("Failed to fetch initiatives");
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const teamMemberIds = await getTeamMemberIds(supabase, user.id);

      // Fetch team members (owners)
      const { data: ownersData, error: ownersError } = await supabase
        .from("business_info")
        .select("id, full_name, profile_picture_url")
        .in("user_id", teamMemberIds);

      if (ownersError) throw ownersError;
      setOwners(ownersData || []);

      // Fetch departments
      const { data: departmentsData, error: departmentsError } = await supabase
        .from("departments")
        .select("id, name");

      if (departmentsError) throw departmentsError;
      setDepartments(departmentsData || []);

      // Fetch playbooks
      const { data: playbooksData, error: playbooksError } = await supabase
        .from("playbooks")
        .select("id, playbookname")
        .in("user_id", teamMemberIds);

      if (playbooksError) throw playbooksError;
      setPlaybooks(playbooksData || []);
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
    }
  };

  const handleAddNew = () => {
    setCurrentInitiative(null);
    setFormData({
      name: "",
      status: "Backlog",
      owner_id: null,
      stakeholders: [],
      due_date: null,
      results: null,
      associated_playbook_id: null,
      department_ids: [],
    });
    setStakeholderInput("");
    setDialogOpen(true);
  };

  const handleEdit = (initiative: KeyInitiative) => {
    setCurrentInitiative(initiative);
    setFormData({
      name: initiative.name,
      status: initiative.status,
      owner_id: initiative.owner_id,
      stakeholders: initiative.stakeholders || [],
      due_date: initiative.due_date,
      results: initiative.results,
      associated_playbook_id: initiative.associated_playbook_id,
      department_ids: initiative.departments?.map(d => d.id) || [],
    });
    setStakeholderInput(initiative.stakeholders?.join(", ") || "");
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this initiative? This action cannot be undone.")) {
      return;
    }

    try {
      setDeleteLoading(id);
      
      const { error } = await supabase
        .from("key_initiatives")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Initiative deleted successfully");
      await fetchInitiatives();
    } catch (error) {
      console.error("Error deleting initiative:", error);
      toast.error("Failed to delete initiative");
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      if (!formData.name.trim()) {
        toast.error("Initiative name is required");
        return;
      }

      if (!teamId) {
        toast.error("Team ID not found");
        return;
      }

      const stakeholdersArray = stakeholderInput
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const initiativeData = {
        name: formData.name,
        status: formData.status,
        owner_id: formData.owner_id,
        stakeholders: stakeholdersArray,
        due_date: formData.due_date,
        results: formData.results,
        associated_playbook_id: formData.associated_playbook_id,
        team_id: teamId,
        updated_at: new Date().toISOString(),
      };

      let initiativeId: string;

      if (currentInitiative) {
        // Update existing initiative
        const { data: updatedInitiative, error } = await supabase
          .from("key_initiatives")
          .update(initiativeData)
          .eq("id", currentInitiative.id)
          .select("id")
          .single();

        if (error) throw error;
        initiativeId = updatedInitiative.id;
      } else {
        // Create new initiative
        const { data: newInitiative, error } = await supabase
          .from("key_initiatives")
          .insert({ ...initiativeData, created_at: new Date().toISOString() })
          .select("id")
          .single();

        if (error) throw error;
        initiativeId = newInitiative.id;
      }

      // Handle department associations
      await handleDepartmentAssociations(initiativeId, formData.department_ids);

      toast.success(currentInitiative ? "Initiative updated successfully" : "Initiative created successfully");
      setDialogOpen(false);
      await fetchInitiatives();
    } catch (error) {
      console.error("Error saving initiative:", error);
      toast.error("Failed to save initiative");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDepartmentAssociations = async (initiativeId: string, departmentIds: string[]) => {
    // First, remove existing associations
    const { error: deleteError } = await supabase
      .from("key_initiative_departments")
      .delete()
      .eq("key_initiative_id", initiativeId);

    if (deleteError) throw deleteError;

    // Add new associations
    if (departmentIds.length > 0) {
      const associations = departmentIds.map(departmentId => ({
        key_initiative_id: initiativeId,
        department_id: departmentId,
      }));

      const { error: insertError } = await supabase
        .from("key_initiative_departments")
        .insert(associations);

      if (insertError) throw insertError;
    }
  };

  const handleStakeholderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStakeholderInput(e.target.value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Backlog": return "bg-gray-100 text-gray-800";
      case "In Progress": return "bg-blue-100 text-blue-800";
      case "On Track": return "bg-green-100 text-green-800";
      case "Behind": return "bg-red-100 text-red-800";
      case "Completed": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getDepartmentColor = (departmentName: string) => {
    const colors = [
      "bg-blue-600", "bg-green-600", "bg-purple-600", 
      "bg-red-600", "bg-yellow-600", "bg-indigo-600", "bg-pink-600"
    ];
    
    const hash = departmentName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `${colors[hash % colors.length]} text-white`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="max-w-full mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Key Initiatives</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and track your organization's strategic initiatives and their progress.
          </p>
        </div>
        <Button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Add Initiative
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : (
        <Card className="overflow-hidden border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-gray-50/50">
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Status</TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Owner</TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Stakeholders</TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Due Date</TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Team(s)</TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Results</TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Playbook</TableHead>
                  <TableHead className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {initiatives.map((initiative) => (
                  <TableRow key={initiative.id} className="border-b border-gray-100 hover:bg-gray-50/30">
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                      <div className="flex items-center gap-3">
                        <Target className="h-5 w-5 text-gray-400" />
                        <span>{initiative.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm border-l">
                      <Badge className={getStatusColor(initiative.status)}>
                        {initiative.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm border-l">
                      {initiative.owner ? (
                        <Link 
                          href="/chain-of-command" 
                          className="text-blue-600 hover:underline flex items-center gap-2"
                        >
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={initiative.owner.profile_picture_url || ''} alt={initiative.owner.full_name} />
                            <AvatarFallback>{initiative.owner.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                          </Avatar>
                          {initiative.owner.full_name}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-normal text-sm text-gray-600 border-l">
                      {initiative.stakeholders?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {initiative.stakeholders.map((stakeholder, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {stakeholder}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 border-l">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {formatDate(initiative.due_date)}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-normal text-sm border-l">
                      {initiative.departments?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {initiative.departments.map((department) => (
                            <Badge 
                              key={department.id} 
                              className={getDepartmentColor(department.name)}
                            >
                              {department.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-normal text-sm text-gray-600 border-l max-w-xs">
                      {initiative.results ? (
                        <div className="truncate" title={initiative.results}>
                          {initiative.results}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm border-l">
                      {initiative.playbook ? (
                        <Link 
                          href={`/playbook-planner?playbook=${initiative.playbook.id}`} 
                          className="text-blue-600 hover:underline flex items-center gap-2"
                        >
                          <span className="truncate max-w-[150px]">{initiative.playbook.playbookname}</span>
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-right border-l">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 text-gray-500 hover:text-gray-800">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(initiative)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(initiative.id)}
                            className="text-red-600 focus:text-red-600"
                            disabled={deleteLoading === initiative.id}
                          >
                            {deleteLoading === initiative.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

             {/* Add/Edit Dialog */}
       <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
         <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>
               {currentInitiative ? "Edit Initiative" : "Add New Initiative"}
             </DialogTitle>
           </DialogHeader>
           <div className="grid gap-4 py-4">
             {/* Initiative Name */}
             <div className="grid gap-2">
               <Label htmlFor="name">Initiative Name*</Label>
               <Input
                 id="name"
                 value={formData.name}
                 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                 placeholder="Enter initiative name"
               />
             </div>
 
             {/* Status and Owner */}
             <div className="grid grid-cols-2 gap-4">
               <div className="grid gap-2">
                 <Label htmlFor="status">Status*</Label>
                 <Select
                   value={formData.status}
                   onValueChange={(value) => setFormData({ ...formData, status: value as KeyInitiativeFormData["status"] })}
                 >
                   <SelectTrigger id="status">
                     <SelectValue placeholder="Select status" />
                   </SelectTrigger>
                   <SelectContent side="bottom" align="start">
                     <SelectItem value="Backlog" className="cursor-pointer hover:bg-accent">Backlog</SelectItem>
                     <SelectItem value="In Progress" className="cursor-pointer hover:bg-accent">In Progress</SelectItem>
                     <SelectItem value="On Track" className="cursor-pointer hover:bg-accent">On Track</SelectItem>
                     <SelectItem value="Behind" className="cursor-pointer hover:bg-accent">Behind</SelectItem>
                     <SelectItem value="Completed" className="cursor-pointer hover:bg-accent">Completed</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
 
               <div className="grid gap-2">
                 <Label htmlFor="owner">Owner</Label>
                 <Select
                   value={formData.owner_id || ""}
                   onValueChange={(value) => setFormData({ ...formData, owner_id: value === "null" ? null : value })}
                 >
                   <SelectTrigger id="owner">
                     <SelectValue placeholder="Select owner" />
                   </SelectTrigger>
                   <SelectContent side="bottom" align="start">
                     <SelectItem value="null" className="cursor-pointer hover:bg-accent">No Owner</SelectItem>
                     {owners.map((owner) => (
                       <SelectItem key={owner.id} value={owner.id} className="cursor-pointer hover:bg-accent">
                         <div className="flex items-center gap-2">
                           <Avatar className="h-6 w-6">
                             <AvatarImage src={owner.profile_picture_url || ''} alt={owner.full_name} />
                             <AvatarFallback>{owner.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                           </Avatar>
                           <span>{owner.full_name}</span>
                         </div>
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
             </div>
 
             {/* Due Date and Associated Playbook */}
             <div className="grid grid-cols-2 gap-4">
               <div className="grid gap-2">
                 <Label htmlFor="due_date">Due Date</Label>
                 <Input
                   id="due_date"
                   type="date"
                   value={formData.due_date || ""}
                   onChange={(e) => setFormData({ ...formData, due_date: e.target.value || null })}
                 />
               </div>
 
               <div className="grid gap-2">
                 <Label htmlFor="playbook">Associated Playbook</Label>
                 <Select
                   value={formData.associated_playbook_id || ""}
                   onValueChange={(value) => setFormData({ ...formData, associated_playbook_id: value === "null" ? null : value })}
                 >
                   <SelectTrigger id="playbook">
                     <SelectValue placeholder="Select playbook" />
                   </SelectTrigger>
                   <SelectContent side="bottom" align="start">
                     <SelectItem value="null" className="cursor-pointer hover:bg-accent">No Playbook</SelectItem>
                     {playbooks.map((playbook) => (
                       <SelectItem key={playbook.id} value={playbook.id} className="cursor-pointer hover:bg-accent">
                         {playbook.playbookname}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
             </div>
 
             {/* Stakeholders */}
             <div className="grid gap-2">
               <Label htmlFor="stakeholders">Stakeholders</Label>
               <Input
                 id="stakeholders"
                 value={stakeholderInput}
                 onChange={handleStakeholderChange}
                 placeholder="Enter stakeholders separated by commas"
               />
             </div>
 
             {/* Teams (Departments) - Compact Grid Layout */}
             <div className="grid gap-2">
               <Label htmlFor="departments">Teams (Departments)</Label>
               <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                 <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                   {departments.map((department) => (
                     <div key={department.id} className="flex items-center space-x-2">
                       <Checkbox
                         id={`dept-${department.id}`}
                         checked={formData.department_ids.includes(department.id)}
                         onCheckedChange={(checked) => {
                           if (checked) {
                             setFormData({
                               ...formData,
                               department_ids: [...formData.department_ids, department.id]
                             });
                           } else {
                             setFormData({
                               ...formData,
                               department_ids: formData.department_ids.filter(id => id !== department.id)
                             });
                           }
                         }}
                       />
                       <Label htmlFor={`dept-${department.id}`} className="text-sm font-normal leading-none">
                         {department.name}
                       </Label>
                     </div>
                   ))}
                 </div>
               </div>
             </div>
 
             {/* Results */}
             <div className="grid gap-2">
               <Label htmlFor="results">Results</Label>
               <Textarea
                 id="results"
                 value={formData.results || ""}
                 onChange={(e) => setFormData({ ...formData, results: e.target.value || null })}
                 placeholder="Enter results or outcomes"
                 className="min-h-[80px]"
               />
             </div>
 
             {/* Action Buttons */}
             <div className="flex justify-end space-x-3 pt-4 border-t">
               <Button variant="outline" onClick={() => setDialogOpen(false)}>
                 Cancel
               </Button>
               <Button 
                 onClick={handleSave}
                 className="bg-blue-600 hover:bg-blue-700 text-white"
                 disabled={isSaving || !formData.name.trim()}
               >
                 {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 {currentInitiative ? "Update Initiative" : "Create Initiative"}
               </Button>
             </div>
           </div>
         </DialogContent>
       </Dialog>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Pencil, Trash2, Search, Filter, ExternalLink } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamMemberIds } from "@/utils/supabase/teams";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, FormItem, FormControl, FormLabel } from "@/components/ui/form";
import { Form } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

type PlaybookOwner = {
  id: string;
  full_name: string;
  profile_picture_url?: string;
};

type Department = {
  id: string;
  name: string;
}

type PlaybookData = {
  id: string;
  user_id: string;
  playbookname: string;
  description: string;
  enginetype: "GROWTH" | "FULFILLMENT" | "INNOVATION";
  owners: PlaybookOwner[];
  department_id: string | null;
  department: Department | null;
  status: "Backlog" | "In Progress" | "Behind" | "Completed";
  link: string;
  created_at: string;
  updated_at: string;
};

type PlaybookFormData = {
  playbookname: string;
  description: string;
  enginetype: "GROWTH" | "FULFILLMENT" | "INNOVATION";
  owner_ids: string[];
  department_id: string | null;
  status: "Backlog" | "In Progress" | "Behind" | "Completed";
  link: string;
};

function PlaybookForm({ form, departments, teamMembers, handleSavePlaybook, setDialogOpen, isSaving, currentPlaybook, formData, setFormData }: any) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSavePlaybook)} className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="playbookName">Playbook Name*</Label>
          <Input
            id="playbookName"
            value={formData.playbookname}
            onChange={(e) => setFormData({ ...formData, playbookname: e.target.value })}
            placeholder="Enter playbook name"
          />
        </div>
        
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter description"
            className="min-h-[80px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="engineType">Engine Type*</Label>
            <Select
              value={formData.enginetype}
              onValueChange={(value) => setFormData({ ...formData, enginetype: value as PlaybookFormData["enginetype"] })}
            >
              <SelectTrigger id="engineType">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GROWTH">GROWTH</SelectItem>
                <SelectItem value="FULFILLMENT">FULFILLMENT</SelectItem>
                <SelectItem value="INNOVATION">INNOVATION</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="status">Status*</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as PlaybookFormData["status"] })}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Backlog">Backlog</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Behind">Behind</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="department">Department</Label>
          <Select
            value={formData.department_id || ""}
            onValueChange={(value) => setFormData({ ...formData, department_id: value === "null" ? null : value })}
          >
            <SelectTrigger id="department">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="null">No Department</SelectItem>
              {departments.map((department: Department) => (
                <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="owner">Owners</Label>
          <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
            {teamMembers.map((member: PlaybookOwner) => (
              <FormField
                key={member.id}
                control={form.control}
                name="owner_ids"
                render={({ field }) => (
                  <FormItem
                    key={member.id}
                    className="flex flex-row items-center space-x-3 space-y-0"
                  >
                    <FormControl>
                      <Checkbox
                        checked={field.value?.includes(member.id)}
                        onCheckedChange={(checked) => {
                          const newValues = field.value ? [...field.value] : [];
                          if (checked) newValues.push(member.id);
                          else {
                            const index = newValues.indexOf(member.id);
                            if (index > -1) newValues.splice(index, 1);
                          }
                          field.onChange(newValues);
                        }}
                      />
                    </FormControl>
                    <FormLabel className="font-normal text-sm flex items-center gap-2">
                      <Avatar className="h-6 w-6 mr-2">
                        <AvatarImage src={member.profile_picture_url || ''} alt={member.full_name} />
                        <AvatarFallback>{member.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                      </Avatar>
                      {member.full_name}
                    </FormLabel>
                  </FormItem>
                )}
              />
            ))}
          </div>
        </div>
        
        <div className="grid gap-2">
          <Label htmlFor="link">Link</Label>
          <Input
            id="link"
            value={formData.link}
            onChange={(e) => setFormData({ ...formData, link: e.target.value })}
            placeholder="Enter link to documentation/resource"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button 
            type="button"
            variant="outline" 
            onClick={() => setDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isSaving || !formData.playbookname.trim()}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {currentPlaybook ? "Update Playbook" : "Create Playbook"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function GrowthEngineLibraryPage() {
  const [playbooksData, setPlaybooksData] = useState<PlaybookData[]>([]);
  const [teamMembers, setTeamMembers] = useState<PlaybookOwner[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filteredData, setFilteredData] = useState<PlaybookData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPlaybook, setCurrentPlaybook] = useState<PlaybookData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [activeEngineType, setActiveEngineType] = useState<string>("all");
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<PlaybookFormData>({
    playbookname: "",
    description: "",
    enginetype: "GROWTH",
    owner_ids: [],
    department_id: null,
    status: "Backlog",
    link: ""
  });
  
  const form = useForm<PlaybookFormData>({
    defaultValues: formData,
  });

  const supabase = createClient();

  useEffect(() => {
    fetchPlaybooksData();
    fetchDropdownData();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === "" && activeEngineType === "all") {
      setFilteredData(playbooksData);
    } else {
      let filtered = playbooksData;
      
      // Filter by engine type if not "all"
      if (activeEngineType !== "all") {
        filtered = filtered.filter(playbook => 
          playbook.enginetype === activeEngineType
        );
      }
      
      // Filter by search term if provided
      if (searchTerm.trim() !== "") {
        const lowercasedSearch = searchTerm.toLowerCase();
        filtered = filtered.filter(playbook => 
          playbook.playbookname.toLowerCase().includes(lowercasedSearch) ||
          playbook.description.toLowerCase().includes(lowercasedSearch) ||
          playbook.owners.some(owner => owner.full_name.toLowerCase().includes(lowercasedSearch))
        );
      }
      
      setFilteredData(filtered);
    }
  }, [searchTerm, activeEngineType, playbooksData]);

  const fetchPlaybooksData = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No authenticated user");
      
      const teamMemberIds = await getTeamMemberIds(supabase, user.id);
      
      const { data, error } = await supabase
        .from("playbooks")
        .select(`
          *,
          department:departments(id, name),
          playbook_assignments (
            assignment_type,
            business_info ( id, full_name, profile_picture_url )
          )
        `)
        .in("user_id", teamMemberIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const processedData = data.map(playbook => {
        const owners = playbook.playbook_assignments
          .filter((pa: any) => pa.assignment_type === 'Owner' && pa.business_info)
          .map((pa: any) => ({
            ...pa.business_info,
            profile_picture_url: pa.business_info.profile_picture_url
          }));
        
        const { playbook_assignments, ...rest } = playbook;

        return {
          ...rest,
          owners,
        };
      });

      setPlaybooksData(processedData || []);
      setFilteredData(processedData || []);
    } catch (error) {
      console.error("Error fetching playbooks data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const teamMemberIds = await getTeamMemberIds(supabase, user.id);

      // Fetch Team Members
      const { data: teamMembersData, error: teamMembersError } = await supabase
        .from("business_info")
        .select("id, full_name, profile_picture_url")
        .in("user_id", teamMemberIds);

      if (teamMembersError) throw teamMembersError;
      setTeamMembers(teamMembersData || []);
      
      // Fetch Departments
      const { data: departmentsData, error: departmentsError } = await supabase
        .from("departments")
        .select("id, name");
      
      if (departmentsError) throw departmentsError;
      setDepartments(departmentsData || []);

    } catch (error) {
      console.error("Error fetching dropdown data:", error);
    }
  };

  const handleAddNew = () => {
    setCurrentPlaybook(null);
    setFormData({
      playbookname: "",
      description: "",
      enginetype: "GROWTH",
      owner_ids: [],
      department_id: null,
      status: "Backlog",
      link: ""
    });
    setDialogOpen(true);
  };

  const handleEdit = (playbook: PlaybookData) => {
    setCurrentPlaybook(playbook);
    setFormData({
      playbookname: playbook.playbookname,
      description: playbook.description,
      enginetype: playbook.enginetype,
      owner_ids: playbook.owners.map(o => o.id),
      department_id: playbook.department_id,
      status: playbook.status,
      link: playbook.link
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this playbook? This action cannot be undone.")) {
      return;
    }
    try {
      setDeleteLoading(id);
      
      const { error } = await supabase
        .from("playbooks")
        .delete()
        .eq("id", id);
        
      if (error) throw error;
      
      await fetchPlaybooksData();
    } catch (error) {
      console.error("Error deleting playbook:", error);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleSavePlaybook = async () => {
    try {
      setIsSaving(true);
      
      if (!formData.playbookname.trim()) {
        throw new Error("Playbook name is required.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const playbookPayload = {
        playbookname: formData.playbookname,
        description: formData.description,
        enginetype: formData.enginetype,
        status: formData.status,
        link: formData.link,
        department_id: formData.department_id,
        user_id: user.id
      };

      let playbookId: string;

      if (currentPlaybook) {
        // Update existing playbook
        const { data: updatedPlaybook, error } = await supabase
          .from("playbooks")
          .update(playbookPayload)
          .eq("id", currentPlaybook.id)
          .select("id")
          .single();
          
        if (error) throw error;
        playbookId = updatedPlaybook.id;
      } else {
        // Create new playbook
        const { data: newPlaybook, error } = await supabase
          .from("playbooks")
          .insert(playbookPayload)
          .select("id")
          .single();
          
        if (error) throw error;
        playbookId = newPlaybook.id;
      }
      
      await handlePlaybookAssignment(playbookId, formData.owner_ids);
      
      await fetchPlaybooksData();
      setDialogOpen(false);
    } catch (error) {
      console.error("Error saving playbook:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePlaybookAssignment = async (playbookId: string, ownerIds: string[]) => {
    // First, clear all existing owner assignments for this playbook
    const { error: deleteError } = await supabase
      .from('playbook_assignments')
      .delete()
      .eq('playbook_id', playbookId)
      .eq('assignment_type', 'Owner');

    if (deleteError) {
      console.error('Error clearing old owners:', deleteError);
      throw deleteError;
    }

    // If no new owners, we are done
    if (!ownerIds || ownerIds.length === 0) {
      return;
    }

    // Add the new assignments
    const newAssignments = ownerIds.map(ownerId => ({
      playbook_id: playbookId,
      user_id: ownerId,
      assignment_type: 'Owner'
    }));

    const { error: insertError } = await supabase
      .from('playbook_assignments')
      .insert(newAssignments);
    
    if (insertError) {
      console.error('Error assigning new owners:', insertError);
      throw insertError;
    }
  }

  const getDepartmentColor = (departmentName: string | undefined) => {
    if (!departmentName) return "bg-gray-200 text-gray-800";
  
    const colors = [
      "bg-blue-600", "bg-green-600", "bg-purple-600", 
      "bg-red-600", "bg-yellow-600", "bg-indigo-600", "bg-pink-600"
    ];
    
    // Simple hash function to get a consistent color for a department name
    const hash = departmentName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `${colors[hash % colors.length]} text-white`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Backlog":
        return "bg-gray-100 text-gray-800";
      case "In Progress":
        return "bg-blue-100 text-blue-800";
      case "Behind":
        return "bg-red-100 text-red-800";
      case "Completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getEngineTypeColor = (type: string) => {
    switch (type) {
      case "GROWTH":
        return "bg-blue-100 text-blue-800";
      case "FULFILLMENT":
        return "bg-purple-100 text-purple-800";
      case "INNOVATION":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Growth Engine Library</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your business engine playbooks and documentation
          </p>
        </div>
        <Button 
          onClick={handleAddNew}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Playbook
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : (
        <Card className="overflow-hidden border-gray-200">
          <div className="p-4 bg-white border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, description, owner..."
                className="pl-10 pr-4 py-2 w-full border-gray-200 rounded-md"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Tabs 
              value={activeEngineType} 
              onValueChange={setActiveEngineType}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid grid-cols-4 w-full sm:w-auto">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="GROWTH" className="text-xs">Growth</TabsTrigger>
                <TabsTrigger value="FULFILLMENT" className="text-xs">Fulfillment</TabsTrigger>
                <TabsTrigger value="INNOVATION" className="text-xs">Innovation</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="flex items-center text-sm text-gray-500 ml-auto">
              <Filter className="h-4 w-4 mr-1" />
              {filteredData.length} of {playbooksData.length} playbooks
            </div>
          </div>

          {playbooksData.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No playbooks found</h3>
              <p className="text-gray-500 mb-6">Get started by adding your first playbook.</p>
              <Button
                onClick={handleAddNew}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Playbook
              </Button>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No matching playbooks</h3>
              <p className="text-gray-500">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50/50">
                  <TableRow className="border-b border-gray-100">
                    <TableHead className="w-[250px] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Playbook Name</TableHead>
                    <TableHead className="w-[150px] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Engine Type</TableHead>
                    <TableHead className="w-[150px] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Department</TableHead>
                    <TableHead className="w-[200px] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Owners</TableHead>
                    <TableHead className="w-[120px] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Status</TableHead>
                    <TableHead className="w-[120px] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Link</TableHead>
                    <TableHead className="w-[120px] px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((playbook) => (
                    <TableRow 
                      key={playbook.id} 
                      className="border-b border-gray-100 hover:bg-blue-50/30"
                    >
                      <TableCell className="px-6 py-4">
                        <div>
                          <div className="font-medium text-blue-700">{playbook.playbookname}</div>
                          {playbook.description && (
                            <div className="text-xs text-gray-500 mt-1 line-clamp-1">{playbook.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap border-l">
                        <Badge variant="outline" className={`px-2.5 py-1 rounded-full text-xs font-medium ${getEngineTypeColor(playbook.enginetype)}`}>
                          {playbook.enginetype}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap border-l">
                        {playbook.department?.name && <Badge className={getDepartmentColor(playbook.department.name)}>{playbook.department.name}</Badge>}
                      </TableCell>
                      <TableCell className="px-6 py-4 border-l">
                        <div className="flex flex-wrap gap-2">
                          {playbook.owners.length > 0 ? playbook.owners.map(o => (
                            <div key={o.id} className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={o.profile_picture_url || ''} alt={o.full_name} />
                                <AvatarFallback>{o.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                              </Avatar>
                              <span>{o.full_name}</span>
                            </div>
                          )) : '—'}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap border-l">
                        <Badge variant="outline" className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(playbook.status)}`}>
                          {playbook.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap border-l">
                        {playbook.link ? (
                          <a 
                            href={playbook.link.startsWith('http') ? playbook.link : `https://${playbook.link}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 flex items-center"
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            <span className="text-sm">Link</span>
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right border-l">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(playbook)}
                            className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
                            title="Edit playbook"
                          >
                            <Pencil className="h-4 w-4 text-gray-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(playbook.id)}
                            className="h-8 w-8 p-0 hover:bg-red-100 rounded-full"
                            title="Delete playbook"
                            disabled={deleteLoading === playbook.id}
                          >
                            {deleteLoading === playbook.id ? (
                              <Loader2 className="h-4 w-4 text-red-600 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-600" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {/* Add/Edit Playbook Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{currentPlaybook ? "Edit Playbook" : "Add New Playbook"}</DialogTitle>
          </DialogHeader>
          <PlaybookForm
            form={form}
            departments={departments}
            teamMembers={teamMembers}
            handleSavePlaybook={handleSavePlaybook}
            setDialogOpen={setDialogOpen}
            isSaving={isSaving}
            currentPlaybook={currentPlaybook}
            formData={formData}
            setFormData={setFormData}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
} 
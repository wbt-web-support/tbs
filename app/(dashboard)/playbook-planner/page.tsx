"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Pencil, Trash2, Search, Filter, ExternalLink, Building2, Hash, BarChart3, Target, Edit, Settings, Sparkles, Save, X, XCircle } from "lucide-react";
import ReusableTiptapEditor from '@/components/reusable-tiptap-editor';
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { getTeamMemberIds } from "@/utils/supabase/teams";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { DepartmentDropdown } from "@/components/ui/dropdown-helpers";
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

function PlaybookForm({ form, departments, teamMembers, handleSavePlaybook, setDialogOpen, isSaving, currentPlaybook }: any) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSavePlaybook)} className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="playbookName">Playbook Name*</Label>
          <FormField
            control={form.control}
            name="playbookname"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Enter playbook name"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Enter description"
                    className="min-h-[80px]"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="engineType">Engine Type*</Label>
            <FormField
              control={form.control}
              name="enginetype"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <CustomDropdown
                      options={[
                        { value: "GROWTH", label: "Growth" },
                        { value: "FULFILLMENT", label: "Fulfilment" },
                        { value: "INNOVATION", label: "Innovation" },
                      ]}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select type"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="status">Status*</Label>
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <CustomDropdown
                      options={[
                        { value: "Backlog", label: "Backlog" },
                        { value: "In Progress", label: "In Progress" },
                        { value: "Behind", label: "Behind" },
                        { value: "Completed", label: "Completed" },
                      ]}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select status"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="department">Department</Label>
          <FormField
            control={form.control}
            name="department_id"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <DepartmentDropdown
                    departments={departments}
                    value={field.value || ""}
                    onChange={(value) => field.onChange(value === "null" ? null : value)}
                    placeholder="Select department"
                  />
                </FormControl>
              </FormItem>
            )}
          />
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
        
        <div className="grid gap-2 hidden">
          <Label htmlFor="link">External Link (Optional)</Label>
          <FormField
            control={form.control}
            name="link"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Enter link to external documentation (optional)"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <p className="text-xs text-gray-500">
            You can add content directly using our rich text editor after creating the playbook.
          </p>
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
            disabled={isSaving}
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
  const router = useRouter();
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlaybooks, setGeneratedPlaybooks] = useState<any[]>([]);
  const [savingPlaybookIds, setSavingPlaybookIds] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  // New state for generation modal
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false);
  const [playbookSuggestions, setPlaybookSuggestions] = useState<any[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [manualPlaybooks, setManualPlaybooks] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [viewingPlaybook, setViewingPlaybook] = useState<any | null>(null);
  const [viewPlaybookContent, setViewPlaybookContent] = useState<string>('');
  
  // Local storage key
  const STORAGE_KEY = 'playbook-planner-generated-playbooks';
  

  
  const form = useForm<PlaybookFormData>({
    defaultValues: {
      playbookname: "",
      description: "",
      enginetype: "GROWTH",
      owner_ids: [],
      department_id: null,
      status: "Backlog",
      link: ""
    },
  });

  const supabase = createClient();

  useEffect(() => {
    fetchPlaybooksData();
    fetchDropdownData();
    loadFromLocalStorage();
  }, []);

  // Save to local storage whenever generatedPlaybooks changes
  useEffect(() => {
    if (generatedPlaybooks.length > 0) {
      saveToLocalStorage();
    }
  }, [generatedPlaybooks]);

  // Load from local storage
  const loadFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.generatedPlaybooks && Array.isArray(data.generatedPlaybooks)) {
          setGeneratedPlaybooks(data.generatedPlaybooks);
        }
      }
    } catch (error) {
      console.error('Error loading from local storage:', error);
    }
  };

  // Save to local storage
  const saveToLocalStorage = () => {
    try {
      const data = {
        generatedPlaybooks: generatedPlaybooks,
        lastGenerated: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to local storage:', error);
    }
  };

  // Clear local storage
  const clearLocalStorage = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing local storage:', error);
    }
  };

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
      
      // Get user role first
      const { data: userData } = await supabase
        .from('business_info')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      setUserRole(userData?.role || null);
      
      let query;
      
      if (userData?.role === 'user') {
        // For users with 'user' role, only show playbooks they are assigned to
        query = supabase
          .from("playbooks")
          .select(`
            *,
            department:departments(id, name),
            playbook_assignments!inner (
              assignment_type,
              business_info!inner ( id, full_name, profile_picture_url )
            )
          `)
          .eq('playbook_assignments.business_info.user_id', user.id)
          .order("created_at", { ascending: false });
      } else {
        // For admin and super_admin, show all team playbooks
        const teamMemberIds = await getTeamMemberIds(supabase, user.id);
        
        query = supabase
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
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const processedData = data.map((playbook: any) => {
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
    const defaultFormData = {
      playbookname: "",
      description: "",
      enginetype: "GROWTH" as const,
      owner_ids: [],
      department_id: null,
      status: "Backlog" as const,
      link: ""
    };
    form.reset(defaultFormData);
    setDialogOpen(true);
  };

  const handleEdit = (playbook: PlaybookData) => {
    setCurrentPlaybook(playbook);
    const editFormData = {
      playbookname: playbook.playbookname,
      description: playbook.description,
      enginetype: playbook.enginetype,
      owner_ids: playbook.owners.map(o => o.id),
      department_id: playbook.department_id,
      status: playbook.status,
      link: playbook.link
    };
    form.reset(editFormData);
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

  const handleSavePlaybook = async (data: PlaybookFormData) => {
    try {
      setIsSaving(true);
      
      if (!data.playbookname.trim()) {
        throw new Error("Playbook name is required.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const playbookPayload = {
        playbookname: data.playbookname,
        description: data.description,
        enginetype: data.enginetype,
        status: data.status,
        link: data.link,
        department_id: data.department_id,
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
      
      await handlePlaybookAssignment(playbookId, data.owner_ids);
      
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
  };

  // Open generation modal and fetch suggestions
  const handleGeneratePlaybook = async () => {
    setGenerationDialogOpen(true);
    setSelectedSuggestions(new Set());
    // Initialize with one empty manual playbook
    const defaultManual = {
      id: `manual-${Date.now()}-${Math.random()}`,
      playbookname: '',
      enginetype: 'GROWTH' as const,
      department_id: null,
      owner_ids: [] as string[],
      description: ''
    };
    setManualPlaybooks([defaultManual]);
    await fetchSuggestions();
  };

  // Fetch playbook suggestions
  const fetchSuggestions = async () => {
    try {
      setIsLoadingSuggestions(true);
      
      const response = await fetch('/api/gemini/playbook-planner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'suggest'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const result = await response.json();
      
      if (result.success && result.data && result.data.suggestions) {
        // Add unique IDs to suggestions for tracking
        const suggestionsWithIds = result.data.suggestions.map((s: any, index: number) => ({
          ...s,
          suggestionId: index,
          selected: false
        }));
        setPlaybookSuggestions(suggestionsWithIds);
      } else {
        throw new Error('No suggestions data received');
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      alert('Failed to fetch playbook suggestions. Please try again.');
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Toggle suggestion selection
  const toggleSuggestion = (index: number) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSuggestions(newSelected);
  };

  // Update suggestion field
  const updateSuggestion = (index: number, field: string, value: any) => {
    setPlaybookSuggestions(playbookSuggestions.map((s, i) => 
      i === index ? { ...s, [field]: value } : s
    ));
  };

  // Add manual playbook entry
  const addManualPlaybook = () => {
    const newEntry = {
      id: `manual-${Date.now()}-${Math.random()}`,
      playbookname: '',
      enginetype: 'GROWTH' as const,
      department_id: null,
      owner_ids: [] as string[],
      description: ''
    };
    setManualPlaybooks([...manualPlaybooks, newEntry]);
  };

  // Remove manual playbook entry
  const removeManualPlaybook = (id: string) => {
    setManualPlaybooks(manualPlaybooks.filter(p => p.id !== id));
  };

  // Update manual playbook field
  const updateManualPlaybook = (id: string, field: string, value: any) => {
    setManualPlaybooks(manualPlaybooks.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  // Generate playbooks from selected suggestions and manual entries
  const handleGenerateFromModal = async () => {
    try {
      // Collect all playbook specs
      const playbookSpecs: any[] = [];

      // Add selected suggestions
      selectedSuggestions.forEach(index => {
        const suggestion = playbookSuggestions[index];
        if (suggestion) {
          playbookSpecs.push({
            playbookname: suggestion.playbookname,
            description: suggestion.description,
            enginetype: suggestion.enginetype,
            department_id: suggestion.recommended_department_id || null,
            owner_ids: suggestion.recommended_owner_ids || []
          });
        }
      });

      // Add manual playbooks
      manualPlaybooks.forEach(manual => {
        if (manual.playbookname.trim()) {
          playbookSpecs.push({
            playbookname: manual.playbookname,
            description: manual.description || '',
            enginetype: manual.enginetype,
            department_id: manual.department_id || null,
            owner_ids: manual.owner_ids || []
          });
        }
      });

      if (playbookSpecs.length === 0) {
        alert('Please select at least one suggestion or add a manual playbook.');
        return;
      }

      setIsGenerating(true);
      setGenerationDialogOpen(false);

      const response = await fetch('/api/gemini/playbook-planner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate',
          playbookSpecs: playbookSpecs
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate playbooks');
      }

      const result = await response.json();
      
      if (result.success && result.data && result.data.playbooks) {
        const newPlaybooks = result.data.playbooks.map((p: any) => ({
          ...p,
          generatedAt: new Date().toISOString()
        }));
        setGeneratedPlaybooks([...generatedPlaybooks, ...newPlaybooks]);
        alert(`${newPlaybooks.length} playbook(s) generated successfully!`);
      } else {
        throw new Error('No playbooks data received from generation');
      }
    } catch (error) {
      console.error('Error generating playbooks:', error);
      alert('Failed to generate playbooks. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveGeneratedPlaybook = async (playbookIndex: number) => {
    if (!generatedPlaybooks || !generatedPlaybooks[playbookIndex]) return;
    
    const playbook = generatedPlaybooks[playbookIndex];
    const playbookId = `generated-${playbookIndex}`;
    
    try {
      setSavingPlaybookIds(prev => [...prev, playbookId]);
      
      const response = await fetch('/api/gemini/playbook-planner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save',
          generatedData: { playbooks: [playbook] }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save generated playbook');
      }

      const result = await response.json();
      
      if (result.success) {
        // Remove the saved playbook from the generated list
        const updated = generatedPlaybooks.filter((_, index) => index !== playbookIndex);
        setGeneratedPlaybooks(updated);
        if (updated.length === 0) {
          clearLocalStorage();
        }
        await fetchPlaybooksData();
        alert('Playbook saved successfully!');
      } else {
        throw new Error('Failed to save playbook');
      }
    } catch (error) {
      console.error('Error saving generated playbook:', error);
      alert('Failed to save generated playbook. Please try again.');
    } finally {
      setSavingPlaybookIds(prev => prev.filter(id => id !== playbookId));
    }
  };

  // Reject/remove generated playbook
  const handleRejectPlaybook = (playbookIndex: number) => {
    if (!confirm('Are you sure you want to remove this playbook? It will be deleted and cannot be recovered.')) {
      return;
    }
    
    const updated = generatedPlaybooks.filter((_, index) => index !== playbookIndex);
    setGeneratedPlaybooks(updated);
    if (updated.length === 0) {
      clearLocalStorage();
    }
  };

  // View playbook
  const handleViewPlaybook = (playbookIndex: number) => {
    if (generatedPlaybooks[playbookIndex]) {
      const playbook = generatedPlaybooks[playbookIndex];
      setViewingPlaybook({ ...playbook, index: playbookIndex });
      setViewPlaybookContent(playbook.content || '<p>No content available</p>');
    }
  };

  const handleSaveAllGeneratedPlaybooks = async () => {
    if (!generatedPlaybooks || generatedPlaybooks.length === 0) return;
    
    try {
      setIsSaving(true);
      
      const response = await fetch('/api/gemini/playbook-planner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save',
          generatedData: { playbooks: generatedPlaybooks }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save generated playbooks');
      }

      const result = await response.json();
      
      if (result.success) {
        const count = generatedPlaybooks.length;
        setGeneratedPlaybooks([]);
        clearLocalStorage();
        await fetchPlaybooksData();
        alert(`${count} playbooks generated and saved successfully!`);
      } else {
        throw new Error('Failed to save playbooks');
      }
    } catch (error) {
      console.error('Error saving generated playbooks:', error);
      alert('Failed to save generated playbooks. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

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
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="md:text-3xl text-2xl font-medium text-gray-900">Playbook & Machine Planner</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your business playbooks and documentation
          </p>
        </div>
        {userRole !== 'user' && (
          <div className="flex gap-3">
            <Button 
              onClick={handleGeneratePlaybook}
              disabled={isGenerating}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {isGenerating ? 'AI Working...' : 'Let AI Help Create Playbooks'}
            </Button>
            {generatedPlaybooks.length > 0 && (
              <Button 
                onClick={handleSaveAllGeneratedPlaybooks}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {isSaving ? 'Saving...' : `Save All (${generatedPlaybooks.length})`}
              </Button>
            )}
            <Button 
              onClick={handleAddNew}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Playbook
            </Button>
          </div>
        )}
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
                <TabsTrigger value="FULFILLMENT" className="text-xs">Fulfilment</TabsTrigger>
                <TabsTrigger value="INNOVATION" className="text-xs">Innovation</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="flex items-center text-sm text-gray-500 ml-auto">
              <Filter className="h-4 w-4 mr-1" />
              {filteredData.length} of {playbooksData.length} playbooks
            </div>
          </div>

          {playbooksData.length === 0 && generatedPlaybooks.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No playbooks found</h3>
              {userRole === 'user' ? (
                <p className="text-gray-500 mb-6">You haven't been assigned any playbooks yet. Contact your administrator to get access to playbooks.</p>
              ) : (
                <>
                  <p className="text-gray-500 mb-6">Get started by adding your first playbook.</p>
                  <Button
                    onClick={handleAddNew}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Playbook
                  </Button>
                </>
              )}
            </div>
          ) : filteredData.length === 0 && generatedPlaybooks.length === 0 ? (
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
                    <TableHead className="w-[180px] px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Generated Playbooks */}
                  {generatedPlaybooks.map((playbook, index) => (
                    <TableRow 
                      key={`generated-${index}`} 
                      className="border-b border-gray-100 hover:bg-purple-50/30 bg-purple-50/20"
                    >
                      <TableCell className="px-6 py-4">
                        <div>
                          <div 
                            className="font-medium text-purple-700 flex items-center gap-2 cursor-pointer hover:text-purple-800 hover:underline transition-colors"
                            onClick={() => handleViewPlaybook(index)}
                          >
                            <Sparkles className="h-4 w-4" />
                            {playbook.playbookname}
                          </div>
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
                        <span className="text-sm text-gray-500">AI Generated</span>
                      </TableCell>
                      <TableCell className="px-6 py-4 border-l">
                        <span className="text-sm text-gray-500">AI Suggested</span>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap border-l">
                        <Badge variant="outline" className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(playbook.status)}`}>
                          {playbook.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-center border-l">
                        <div className="flex justify-center items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewPlaybook(index)}
                            className="h-8 px-3 hover:bg-blue-50 text-blue-600 border-blue-200"
                          >
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSaveGeneratedPlaybook(index)}
                            className="h-8 px-3 hover:bg-purple-100 rounded-full transition-colors text-purple-600"
                            title="Save generated playbook"
                            disabled={savingPlaybookIds.includes(`generated-${index}`)}
                          >
                            {savingPlaybookIds.includes(`generated-${index}`) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-1" />
                                Save
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRejectPlaybook(index)}
                            className="h-8 px-3 hover:bg-red-50 text-red-600 border-red-200"
                          >
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Existing Playbooks */}
                  {filteredData.map((playbook) => (
                    <TableRow 
                      key={playbook.id} 
                      className="border-b border-gray-100 hover:bg-blue-50/30"
                    >
                      <TableCell className="px-6 py-4">
                        <div>
                          <div 
                            className="font-medium text-blue-700 cursor-pointer hover:text-blue-800 hover:underline transition-colors"
                            onClick={() => router.push(`/playbook-planner/edit/${playbook.id}`)}
                          >
                            {playbook.playbookname}
                          </div>
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
                      <TableCell className="px-6 py-4 text-center border-l">
                        <div className="flex justify-center items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/playbook-planner/edit/${playbook.id}`)}
                            className="h-8 w-8 p-0 hover:bg-blue-100 rounded-full transition-colors"
                            title="Edit playbook content"
                          >
                            <Edit className="h-4 w-4 text-blue-600" />
                          </Button>
                          {userRole !== 'user' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(playbook)}
                                className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full transition-colors"
                                title="Edit playbook settings"
                              >
                                <Settings className="h-4 w-4 text-gray-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(playbook.id)}
                                className="h-8 w-8 p-0 hover:bg-red-100 rounded-full transition-colors"
                                title="Delete playbook"
                                disabled={deleteLoading === playbook.id}
                              >
                                {deleteLoading === playbook.id ? (
                                  <Loader2 className="h-4 w-4 text-red-600 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                )}
                              </Button>
                            </>
                          )}
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
          />
        </DialogContent>
      </Dialog>

      {/* Playbook Generation Dialog */}
      <Dialog open={generationDialogOpen} onOpenChange={(open) => {
        setGenerationDialogOpen(open);
        if (!open) {
          // Reset state when closing
          setSelectedSuggestions(new Set());
          setManualPlaybooks([]);
        }
      }}>
        <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Playbooks</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Left Side: Manual Playbook Input */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Manual Playbooks</h3>
                </div>
                <div className="space-y-4">
                  {manualPlaybooks.map((manual) => (
                    <div key={manual.id} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm text-gray-700">Manual Playbook Entry</h4>
                        {manualPlaybooks.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeManualPlaybook(manual.id)}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Playbook Name *</Label>
                          <Input
                            value={manual.playbookname}
                            onChange={(e) => updateManualPlaybook(manual.id, 'playbookname', e.target.value)}
                            placeholder="Enter playbook name"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Engine Type *</Label>
                          <CustomDropdown
                            options={[
                              { value: "GROWTH", label: "Growth" },
                              { value: "FULFILLMENT", label: "Fulfilment" },
                              { value: "INNOVATION", label: "Innovation" },
                            ]}
                            value={manual.enginetype}
                            onChange={(value) => updateManualPlaybook(manual.id, 'enginetype', value)}
                            placeholder="Select type"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Department</Label>
                          <DepartmentDropdown
                            departments={departments}
                            value={manual.department_id || ""}
                            onChange={(value) => updateManualPlaybook(manual.id, 'department_id', value === "null" ? null : value)}
                            placeholder="Select department"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Owners</Label>
                          <div className="border rounded-md p-2 space-y-1 max-h-24 overflow-y-auto">
                            {teamMembers.map((member) => (
                              <div key={member.id} className="flex items-center space-x-2">
                                <Checkbox
                                  checked={manual.owner_ids.includes(member.id)}
                                  onCheckedChange={(checked) => {
                                    const newOwnerIds = checked
                                      ? [...manual.owner_ids, member.id]
                                      : manual.owner_ids.filter((id: string) => id !== member.id);
                                    updateManualPlaybook(manual.id, 'owner_ids', newOwnerIds);
                                  }}
                                />
                                <Label className="text-xs font-normal flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={member.profile_picture_url || ''} alt={member.full_name} />
                                    <AvatarFallback>{member.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                                  </Avatar>
                                  {member.full_name}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          value={manual.description}
                          onChange={(e) => updateManualPlaybook(manual.id, 'description', e.target.value)}
                          placeholder="Enter description (optional)"
                          className="min-h-[60px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addManualPlaybook}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add More
                </Button>
              </div>

              {/* Right Side: AI Suggestions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">AI Suggestions</h3>
                  {isLoadingSuggestions && (
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  )}
                </div>
                {isLoadingSuggestions ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                    <span className="ml-2 text-sm text-gray-500">Loading suggestions...</span>
                  </div>
                ) : playbookSuggestions.length > 0 ? (
                  <div className="space-y-2 max-h-[calc(90vh-200px)] overflow-y-auto">
                    {playbookSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className={`border rounded-md p-2.5 cursor-pointer transition-all ${
                          selectedSuggestions.has(index)
                            ? 'border-purple-500 bg-purple-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                        onClick={() => toggleSuggestion(index)}
                      >
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={selectedSuggestions.has(index)}
                            onCheckedChange={() => toggleSuggestion(index)}
                            className="mt-0.5 h-4 w-4"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 space-y-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 line-clamp-1">{suggestion.playbookname}</div>
                            <div className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{suggestion.description}</div>
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${getEngineTypeColor(suggestion.enginetype)}`}>
                                {suggestion.enginetype}
                              </Badge>
                              {suggestion.recommended_department_id && (
                                <span className="text-[10px] text-gray-500 truncate">
                                  {departments.find(d => d.id === suggestion.recommended_department_id)?.name || 'N/A'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No suggestions available. Try again later.
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-6 mt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setGenerationDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleGenerateFromModal}
                disabled={isGenerating || (selectedSuggestions.size === 0 && manualPlaybooks.length === 0)}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Playbooks
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Playbook Dialog */}
      <Dialog open={!!viewingPlaybook} onOpenChange={(open) => {
        if (!open) {
          setViewingPlaybook(null);
          setViewPlaybookContent('');
        }
      }}>
        <DialogContent className="sm:max-w-[1200px] h-[95vh] flex flex-col p-0">
          <div className="px-6 pt-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle>View Playbook: {viewingPlaybook?.playbookname}</DialogTitle>
            </DialogHeader>
          </div>
          {viewingPlaybook && (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            
              <div className="flex-1 min-h-0 flex flex-col px-6 pb-4">
                <div className="flex-1 border rounded-md overflow-hidden bg-white min-h-0 flex flex-col">
                  <ReusableTiptapEditor
                    content={viewPlaybookContent}
                    onChange={setViewPlaybookContent}
                    onSave={async (content: string) => {
                      // No-op for view mode - content is read-only
                      return Promise.resolve();
                    }}
                    placeholder="No content available"
                    className="flex-1 min-h-0 overflow-y-auto"
                    editorHeight="calc(95vh - 300px)"
                    autoSave={false}
                    showToolbar={true}
                    showBubbleMenu={true}
                    showSlashCommands={false}
                    showStatusBar={false}
                    enableHistory={false}
                    isReadOnly={true}
                    editorClassName="overflow-y-auto max-h-full"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t px-6 pb-6 flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setViewingPlaybook(null);
                    setViewPlaybookContent('');
                  }}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (viewingPlaybook.index !== undefined) {
                      handleRejectPlaybook(viewingPlaybook.index);
                      setViewingPlaybook(null);
                      setViewPlaybookContent('');
                    }
                  }}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (viewingPlaybook.index !== undefined) {
                      handleSaveGeneratedPlaybook(viewingPlaybook.index);
                      setViewingPlaybook(null);
                      setViewPlaybookContent('');
                    }
                  }}
                  disabled={viewingPlaybook.index !== undefined && savingPlaybookIds.includes(`generated-${viewingPlaybook.index}`)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {viewingPlaybook.index !== undefined && savingPlaybookIds.includes(`generated-${viewingPlaybook.index}`) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Playbook
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 
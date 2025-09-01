"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Loader2, 
  Search, 
  User, 
  UserPlus, 
  Eye,
  MoreHorizontal,
  KeyRound,
  FileText,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Define types
interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  business_name: string;
  phone_number: string;
  payment_option: string;
  payment_remaining: number;
  command_hq_link?: string;
  command_hq_created?: boolean;
  gd_folder_created?: boolean;
  meeting_scheduled?: boolean;
  profile_picture_url?: string;
  role: string;
  created_at: string;
  team_id?: string;
  team_admin?: {
    business_name: string;
    full_name: string;
  };
}

interface TimelineEvent {
  id: string;
  event_name: string;
  week_number: number;
  description?: string;
  is_completed?: boolean;
  completion_date?: string;
}

interface ChecklistItem {
  id: string;
  checklist_item: string;
  description?: string;
  is_completed?: boolean;
  completion_date?: string;
}

interface Benefit {
  id: string;
  benefit_title: string;
  benefit_description: string | null;
  is_claimed?: boolean;
  claimed_date?: string;
}

interface NewUserForm {
  email: string;
  password: string;
  full_name: string;
  business_name: string;
  phone_number: string;
  payment_option: string;
  payment_remaining: number;
  command_hq_link: string;
  command_hq_created: boolean;
  gd_folder_created: boolean;
  meeting_scheduled: boolean;
  role: string;
  wbt_onboarding: string;
  wbt_onboarding_type: 'file' | 'url' | '';
  selectedFile: File | null;
  extractedContent: string;
}

export default function UserManagementPage() {
  const router = useRouter();
  
  // State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userDetails, setUserDetails] = useState({
    timeline: [] as TimelineEvent[],
    checklist: [] as ChecklistItem[],
    benefits: [] as Benefit[],
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [showTeamMembers, setShowTeamMembers] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);
  const [newUserForm, setNewUserForm] = useState<NewUserForm>({
    email: "",
    password: "",
    full_name: "",
    business_name: "",
    phone_number: "",
    payment_option: "FULL",
    payment_remaining: 0,
    command_hq_link: "",
    command_hq_created: false,
    gd_folder_created: false,
    meeting_scheduled: false,
    role: "admin",
    wbt_onboarding: "",
    wbt_onboarding_type: "",
    selectedFile: null,
    extractedContent: "",
  });
  const supabase = createClient();
  
  // Current user role for superadmin check
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Fetch users on load
  useEffect(() => {
    fetchUsers();
    fetchCurrentUserRole();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // First, fetch all user profiles
      const { data: profiles, error } = await supabase
        .from('business_info')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      console.log("Fetched profiles:", profiles); // Debug log
      
      if (!profiles || profiles.length === 0) {
        console.log("No profiles found");
        setUsers([]);
        return;
      }
      
      // Get unique team IDs
      const teamIds = Array.from(new Set(profiles.map((p: any) => p.team_id).filter(Boolean)));
      
      // Fetch team admin information
      let teamAdmins: any[] = [];
      if (teamIds.length > 0) {
        const { data: admins, error: adminError } = await supabase
          .from('business_info')
          .select('user_id, business_name, full_name')
          .in('user_id', teamIds);
        
        if (adminError) {
          console.error("Error fetching team admins:", adminError);
        } else {
          teamAdmins = admins || [];
        }
      }
      
      // Merge profiles with team admin info
      const profilesWithTeamAdmin = profiles.map((profile: any) => ({
        ...profile,
        team_admin: profile.team_id 
          ? teamAdmins.find((admin: any) => admin.user_id === profile.team_id) || null
          : null
      }));
      
      setUsers(profilesWithTeamAdmin);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      setDetailsLoading(true);
      
      // Fetch timeline items with user claims
      const { data: timeline, error: timelineError } = await supabase
        .from('chq_timeline')
        .select(`
          id,
          event_name,
          week_number,
          description,
          user_timeline_claims (
            is_completed,
            completion_date
          )
        `)
        .order('week_number', { ascending: true });
      
      if (timelineError) throw timelineError;

      // Fetch checklist items with user claims
      const { data: checklist, error: checklistError } = await supabase
        .from('chq_checklist')
        .select(`
          id,
          checklist_item,
          description,
          user_checklist_claims (
            is_completed,
            completion_date
          )
        `);
      
      if (checklistError) throw checklistError;

      // Fetch benefits with user claims
      const { data: benefits, error: benefitsError } = await supabase
        .from('chq_benefits')
        .select(`
          id,
          benefit_title,
          benefit_description,
          user_benefit_claims (
            is_claimed,
            claimed_date
          )
        `);
      
      if (benefitsError) throw benefitsError;

      // Transform data to include claim status
      const formattedTimeline = timeline?.map((item: any) => ({
        id: item.id,
        event_name: item.event_name,
        week_number: item.week_number,
        description: item.description,
        is_completed: item.user_timeline_claims.length > 0 ? item.user_timeline_claims[0].is_completed : false,
        completion_date: item.user_timeline_claims.length > 0 ? item.user_timeline_claims[0].completion_date : null,
      })) || [];

      const formattedChecklist = checklist?.map((item: any) => ({
        id: item.id,
        checklist_item: item.checklist_item,
        description: item.description,
        is_completed: item.user_checklist_claims.length > 0 ? item.user_checklist_claims[0].is_completed : false,
        completion_date: item.user_checklist_claims.length > 0 ? item.user_checklist_claims[0].completion_date : null,
      })) || [];

      const formattedBenefits = benefits?.map((item: any) => ({
        id: item.id,
        benefit_title: item.benefit_title,
        benefit_description: item.benefit_description,
        is_claimed: item.user_benefit_claims.length > 0 ? item.user_benefit_claims[0].is_claimed : false,
        claimed_date: item.user_benefit_claims.length > 0 ? item.user_benefit_claims[0].claimed_date : null,
      })) || [];

      setUserDetails({
        timeline: formattedTimeline,
        checklist: formattedChecklist,
        benefits: formattedBenefits,
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      toast.error("Failed to load user details");
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchCurrentUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error } = await supabase
          .from('business_info')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (!error && profile) {
          setCurrentUserRole(profile.role);
        }
      }
    } catch (error) {
      console.error("Error fetching current user role:", error);
    }
  };



  const handleViewDetails = (user: UserProfile) => {
    setSelectedUser(user);
    if (user.user_id) {
      fetchUserDetails(user.user_id);
    }
    setIsDialogOpen(true);
  };

  const handleCreateUser = async () => {
    if (!newUserForm.email || !newUserForm.password || !newUserForm.full_name || !newUserForm.business_name) {
      toast.error("Please fill all required fields");
      return;
    }

    // Validate WBT onboarding data
    if (!newUserForm.wbt_onboarding_type) {
      toast.error("Please select WBT onboarding data type (PDF file or URL)");
      return;
    }

    if (newUserForm.wbt_onboarding_type === 'file' && !newUserForm.extractedContent) {
      toast.error("Please upload and extract a PDF file for WBT onboarding data");
      return;
    }

    if (newUserForm.wbt_onboarding_type === 'url' && !newUserForm.extractedContent) {
      toast.error("Please provide a PDF URL and extract the content for WBT onboarding data");
      return;
    }

    try {
      setIsCreatingUser(true);

      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No session token available");
      }

      // Prepare user data with extracted PDF content
      const userData = {
        ...newUserForm,
        wbt_onboarding: newUserForm.extractedContent
      };

      // Use the admin API to create user (this won't log in as the new user)
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(userData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Failed to create user');
      }

      toast.success("User created successfully. The user can now sign in with their email and password.");
      setIsCreateDialogOpen(false);
      
      // Reset form
      setNewUserForm({
        email: "",
        password: "",
        full_name: "",
        business_name: "",
        phone_number: "",
        payment_option: "FULL",
        payment_remaining: 0,
        command_hq_link: "",
        command_hq_created: false,
        gd_folder_created: false,
        meeting_scheduled: false,
        role: "admin",
        wbt_onboarding: "",
        wbt_onboarding_type: "",
        selectedFile: null,
        extractedContent: "",
      });
      
      // Refresh users list
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewUserForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setNewUserForm(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setNewUserForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewUserForm(prev => ({
        ...prev,
        selectedFile: file,
        extractedContent: ""
      }));
    }
  };

  const handleExtractFile = async () => {
    if (!newUserForm.selectedFile) return;

    try {
      setIsExtractingPdf(true);
      const formData = new FormData();
      formData.append('file', newUserForm.selectedFile);

      const response = await fetch('/api/extract/pdf', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to extract PDF content');
      }

      const result = await response.json();
      
      // Store the extracted text content (keep original file info)
      setNewUserForm(prev => ({
        ...prev,
        wbt_onboarding: `File: ${prev.selectedFile?.name || 'PDF File'}`,
        extractedContent: result.content
      }));

      toast.success('PDF content extracted successfully');
    } catch (error) {
      console.error('Error extracting PDF:', error);
      toast.error('Failed to extract PDF content');
    } finally {
      setIsExtractingPdf(false);
    }
  };

  const handleExtractUrl = async () => {
    if (!newUserForm.wbt_onboarding) return;

    try {
      setIsExtractingPdf(true);
      const response = await fetch('/api/extract/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: newUserForm.wbt_onboarding })
      });

      if (!response.ok) {
        throw new Error('Failed to extract PDF content from URL');
      }

      const result = await response.json();
      
      // Store the extracted text content (keep original URL)
      setNewUserForm(prev => ({
        ...prev,
        wbt_onboarding: prev.wbt_onboarding, // Keep the original URL
        extractedContent: result.content
      }));

      toast.success('PDF content extracted from URL successfully');
    } catch (error) {
      console.error('Error extracting PDF from URL:', error);
      toast.error('Failed to extract PDF content from URL. Please check the URL and try again.');
    } finally {
      setIsExtractingPdf(false);
    }
  };

  // Separate regular users from team members
  const regularUsers = users.filter(user => 
    user.role !== 'super_admin' && (!user.team_id || user.role === 'admin')
  );
  
  const teamMembers = users.filter(user => 
    user.team_id && user.role === 'user'
  );

  const displayUsers = showTeamMembers ? [...regularUsers, ...teamMembers] : regularUsers;

  const filteredUsers = displayUsers.filter(user => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      user.full_name.toLowerCase().includes(searchTermLower) ||
      user.business_name.toLowerCase().includes(searchTermLower) ||
      user.email.toLowerCase().includes(searchTermLower)
    );
  });

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const getRandomColor = (id: string) => {
    const colors = [
      "bg-red-500",
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
    ];
    
    // Simple hash function
    const hash = id.split("").reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    
    return colors[hash % colors.length];
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">
            View, create, and manage user accounts
          </p>
          <div className="flex gap-4 mt-3">
            <div className="text-sm">
              <span className="font-medium">{regularUsers.length}</span> regular users
            </div>
            <div className="text-sm text-orange-600">
              <span className="font-medium">{teamMembers.length}</span> team members
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{users.filter(u => u.role === 'super_admin').length}</span> super admins (hidden)
            </div>
          </div>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="w-4 h-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Create New User
              </DialogTitle>
              <DialogDescription>
                Create a new user account and business profile.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-5 py-4">
              <div className="space-y-5">
                <h3 className="font-medium text-sm text-blue-600">Account Information</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="user@example.com"
                      value={newUserForm.email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      value={newUserForm.password}
                      onChange={handleInputChange}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be at least 6 characters.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-5">
                <h3 className="font-medium text-sm text-blue-600">Personal & Business Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="full_name"
                      name="full_name"
                      placeholder="John Doe"
                      value={newUserForm.full_name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="business_name">Business Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="business_name"
                      name="business_name"
                      placeholder="Acme Inc."
                      value={newUserForm.business_name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input
                      id="phone_number"
                      name="phone_number"
                      placeholder="+1 (555) 555-5555"
                      value={newUserForm.phone_number}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-5">
                <h3 className="font-medium text-sm text-blue-600">WBT Onboarding Data</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="wbt_onboarding_type">Onboarding Data Type</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="wbt_onboarding_type"
                          value="file"
                          checked={newUserForm.wbt_onboarding_type === 'file'}
                          onChange={(e) => handleSelectChange('wbt_onboarding_type', e.target.value)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">PDF File</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="wbt_onboarding_type"
                          value="url"
                          checked={newUserForm.wbt_onboarding_type === 'url'}
                          onChange={(e) => handleSelectChange('wbt_onboarding_type', e.target.value)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">PDF URL</span>
                      </label>
                    </div>
                  </div>
                  
                  {newUserForm.wbt_onboarding_type === 'file' && (
                    <div className="space-y-2">
                      <Label htmlFor="wbt_onboarding_file">Upload PDF File</Label>
                      <div className="flex gap-2">
                        <Input
                          id="wbt_onboarding_file"
                          name="wbt_onboarding_file"
                          type="file"
                          accept=".pdf"
                          onChange={(e) => handleFileSelect(e)}
                          className="cursor-pointer flex-1"
                          disabled={isExtractingPdf}
                        />
                        <Button
                          type="button"
                          onClick={handleExtractFile}
                          disabled={!newUserForm.selectedFile || isExtractingPdf}
                          size="sm"
                          className="whitespace-nowrap"
                        >
                          {isExtractingPdf ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Extracting...
                            </>
                          ) : (
                            <>Extract</>
                          )}
                        </Button>
                      </div>
                      {isExtractingPdf && (
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Extracting PDF content...
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Upload a PDF file and click Extract to get the content for AI training.
                      </p>
                      {newUserForm.selectedFile && (
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                          <FileText className="w-4 h-4" />
                          Selected: {newUserForm.selectedFile.name}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                                                          onClick={() => {
                                setNewUserForm(prev => ({
                                  ...prev,
                                  selectedFile: null,
                                  extractedContent: ""
                                }));
                              }}
                            className="h-6 px-2 text-xs"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                      {newUserForm.extractedContent && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-800 font-medium">PDF Content Extracted Successfully</p>
                          <div className="mt-2 space-y-2">
                            <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                              <p className="text-xs text-blue-700 font-medium">Source:</p>
                              <p className="text-xs text-blue-600">
                                {newUserForm.wbt_onboarding}
                              </p>
                            </div>
                           
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowFullContent(true)}
                            >
                              View Full Content
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setNewUserForm(prev => ({
                                  ...prev,
                                  extractedContent: ""
                                }));
                              }}
                            >
                              Clear Content
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {newUserForm.wbt_onboarding_type === 'url' && (
                    <div className="space-y-2">
                      <Label htmlFor="wbt_onboarding">PDF URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="wbt_onboarding"
                          name="wbt_onboarding"
                          type="url"
                          placeholder="https://example.com/document.pdf"
                          value={newUserForm.wbt_onboarding}
                          onChange={handleInputChange}
                          disabled={isExtractingPdf}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          onClick={handleExtractUrl}
                          disabled={!newUserForm.wbt_onboarding || isExtractingPdf}
                          size="sm"
                          className="whitespace-nowrap"
                        >
                          {isExtractingPdf ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Extracting...
                            </>
                          ) : (
                            <>Extract</>
                          )}
                        </Button>
                      </div>
                      {isExtractingPdf && (
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                          <div className="flex items-center gap-2 text-sm text-blue-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Extracting PDF content from URL...
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Enter a PDF URL and click Extract to get the content for AI training.
                      </p>
                      {newUserForm.extractedContent && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-800 font-medium">PDF Content Extracted Successfully</p>
                          <div className="mt-2 space-y-2">
                            <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                              <p className="text-xs text-blue-700 font-medium">Source:</p>
                              <p className="text-xs text-blue-600">
                                {newUserForm.wbt_onboarding}
                              </p>
                            </div>
                            
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowFullContent(true)}
                            >
                              View Full Content
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setNewUserForm(prev => ({
                                  ...prev,
                                  extractedContent: ""
                                }));
                              }}
                            >
                              Clear Content
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              
          </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isCreatingUser}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateUser}
                disabled={isCreatingUser || isExtractingPdf}
              >
                {isCreatingUser ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : isExtractingPdf ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extracting PDF...
                  </>
                ) : (
                  <>Create User</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Full Content Modal */}
        <Dialog open={showFullContent} onOpenChange={setShowFullContent}>
          <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>WBT Onboarding Content</DialogTitle>
              <DialogDescription>
                Full extracted content from the PDF for AI training purposes.
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-4 space-y-4">
              {/* Source Information */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-800 mb-2">Source Information:</p>
                <p className="text-sm text-blue-700">
                  {newUserForm.wbt_onboarding_type === 'file' 
                    ? `File: ${newUserForm.selectedFile?.name || 'PDF File'}`
                    : `URL: ${newUserForm.wbt_onboarding}`
                  }
                </p>
              </div>
              
              {/* Extracted Content */}
              <div className="p-4 bg-gray-50 rounded-lg border">
                <p className="text-sm font-medium text-gray-800 mb-2">Extracted Content:</p>
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono max-h-96 overflow-y-auto">
                  {newUserForm.extractedContent}
                </pre>
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={() => setShowFullContent(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              id="show-team-members"
              checked={showTeamMembers}
              onCheckedChange={setShowTeamMembers}
            />
            <Label htmlFor="show-team-members" className="text-sm whitespace-nowrap">
              Show team members ({teamMembers.length})
            </Label>
          </div>
        </div>

        {!showTeamMembers && teamMembers.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>{teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''}</strong> hidden. 
              Team members are managed by their team admins and cannot be directly administered.
            </p>
          </div>
        )}

        <div className="mb-4 text-sm text-muted-foreground">
          Showing {filteredUsers.length} of {displayUsers.length} users
          {showTeamMembers && teamMembers.length > 0 && (
            <span className="text-blue-600 ml-2">
              (includes {teamMembers.filter(member => 
                member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                member.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                member.email.toLowerCase().includes(searchTerm.toLowerCase())
              ).length} team members)
            </span>
          )}
        </div>

        <div className="rounded-md border">
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead className="w-12"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    {searchTerm 
                      ? "No users found matching your search." 
                      : "No users found. Create your first user by clicking the Add User button."}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const isTeamMember = user.team_id && user.role === 'user';
                return (
                  <TableRow 
                    key={user.id}
                    className={isTeamMember ? 'bg-orange-50 hover:bg-orange-100' : ''}
                  >
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profile_picture_url || ""} alt={user.full_name} />
                        <AvatarFallback className={getRandomColor(user.id)}>
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {user.full_name}
                        {isTeamMember && (
                          <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">
                            Team Member
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        {user.business_name}
                        {isTeamMember && user.team_admin && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Team: {user.team_admin.business_name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {user.role}
                        </Badge>
                        {isTeamMember && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                            In Team
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {isTeamMember ? (
                        <div className="text-xs text-muted-foreground">
                          Managed by team admin
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => router.push(`/admin/users/${user.id}`)}
                              className="flex items-center cursor-pointer"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {currentUserRole === 'super_admin' && (
                              <DropdownMenuItem 
                                onClick={() => router.push(`/admin/users/${user.id}/reset-password`)}
                                className="flex items-center cursor-pointer text-red-600"
                              >
                                <KeyRound className="mr-2 h-4 w-4" />
                                Reset Password
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </Card>


    </div>
  );
} 
"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  User,
  Building,
  Mail,
  Phone,
  CreditCard,
  Calendar,
  CheckSquare,
  ChevronRight,
  Link as LinkIcon,
  MoreHorizontal,
  Save,
  Gift,
  CheckCircle2,
  UserCircle,
  AlertCircle,
  Edit,
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import OnboardingDataModal from "@/components/admin/OnboardingDataModal"; // Added import
import AiOnboardingQuestionsModal from "@/components/admin/AiOnboardingQuestionsModal"; // Added import
import { GlobalServiceAssignment } from "../components/global-service-assignment";

// Types
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
  google_review_link?: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface TimelineEvent {
  id: string;
  event_name: string;
  week_number: number;
  scheduled_date: string;
  description?: string;
  is_completed?: boolean;
  completion_date?: string;
}

interface ChecklistItem {
  id: string;
  checklist_item: string;
  notes?: string;
  is_completed?: boolean;
  completion_date?: string;
}

interface Benefit {
  id: string;
  benefit_name: string;
  notes: string | null;
  is_claimed?: boolean;
  claimed_date?: string;
}

interface BattlePlan {
  id: string;
  missionstatement: string;
  visionstatement: string;
  businessplanlink: string;
  purposewhy: any[];
  strategicanchors: any[];
  corevalues: any[];
  fiveyeartarget: any[];
  created_at: string;
  updated_at: string;
}

interface ChainOfCommand {
  id: string;
  name: string;
  manager: string;
  jobtitle: string;
  department: string;
  criticalaccountabilities: any[];
  playbooksowned: any[];
  created_at: string;
  updated_at: string;
}

interface HWGTPlan {
  id: string;
  howwegetthereplan: any;
  created_at: string;
  updated_at: string;
}

interface Machine {
  id: string;
  enginename: string;
  enginetype: string;
  description: string;
  triggeringevents: any[];
  endingevent: any[];
  actionsactivities: any[];
  figma_link: string;
  figma_embed: string;
  created_at: string;
  updated_at: string;
}

interface Meeting {
  id: string;
  meeting_type: string;
  meeting_date: string;
  meeting_title: string;
  meeting_description: string;
  meeting_color: string;
  created_at: string;
  updated_at: string;
}

interface Playbook {
  id: string;
  playbookname: string;
  description: string;
  enginetype: string;
  owner: string;
  status: string;
  link: string;
  created_at: string;
  updated_at: string;
}

interface QuarterlySprint {
  id: string;
  theme: string;
  revenuegoals: any;
  unitgoals: any[];
  revenuebymonth: any[];
  strategicpillars: string[];
  northstarmetrics: any[];
  keyinitiatives: any[];
  created_at: string;
  updated_at: string;
}

interface TriagePlanner {
  id: string;
  company_info: any;
  what_you_do: string;
  who_you_serve: string;
  what_is_right: any[];
  what_is_wrong: any[];
  what_is_missing: any[];
  what_is_confusing: any[];
  internal_tasks: any[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const supabase = createClient();
  const { id } = use(params);

  // State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editedUser, setEditedUser] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userDetails, setUserDetails] = useState({
    timeline: [] as TimelineEvent[],
    checklist: [] as ChecklistItem[],
    benefits: [] as Benefit[],
    battlePlan: null as BattlePlan | null,
    chainOfCommand: [] as ChainOfCommand[],
    hwgtPlan: null as HWGTPlan | null,
    machines: [] as Machine[],
    meetings: [] as Meeting[],
    playbooks: [] as Playbook[],
    quarterlySprint: null as QuarterlySprint | null,
    triagePlanner: null as TriagePlanner | null,
  });
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [onboardingData, setOnboardingData] = useState<any>(null);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [loadingOnboardingData, setLoadingOnboardingData] = useState(true);
  const [aiOnboardingData, setAiOnboardingData] = useState<any>(null);
  const [isAiOnboardingModalOpen, setIsAiOnboardingModalOpen] = useState(false);
  const [loadingAiOnboardingData, setLoadingAiOnboardingData] = useState(true);

  // Load user data
  useEffect(() => {
    fetchUser();
  }, [id]);

  useEffect(() => {
    const fetchOnboardingData = async () => {
      if (user?.user_id) { // Check if user and user.user_id are available
        setLoadingOnboardingData(true);
        // supabase client is already defined at component scope
        const { data, error } = await supabase
          .from("company_onboarding")
          .select("onboarding_data, completed") // Fetching the specific fields
          .eq("user_id", user.user_id) // Use user.user_id
          .single();

        if (error && error.code !== "PGRST116") { // PGRST116 means no rows found
          console.error("Error fetching onboarding data:", error);
          toast.error("Failed to load onboarding data.");
          setOnboardingData(null);
        } else {
          setOnboardingData(data); // Store the whole data object
        }
        setLoadingOnboardingData(false);
      } else {
        // If no user.user_id, it means no onboarding data can be fetched for this relation yet, or user is not loaded
        setLoadingOnboardingData(false); // Set to false as we are not fetching
        setOnboardingData(null);
      }
    };

    // Only attempt to fetch if user.user_id is present
    if (user?.user_id) {
      fetchOnboardingData();
    } else {
      // If user or user.user_id is not yet available, reflect that we're not actively loading onboarding data for a non-existent/unidentified user.
      // This prevents showing "Loading data..." indefinitely if the main user object hasn't loaded its user_id.
      setLoadingOnboardingData(false); 
      setOnboardingData(null);
    }
  }, [user?.user_id, supabase]); // Depend on user.user_id and supabase client

  useEffect(() => {
    const fetchAiOnboardingData = async () => {
      if (user?.user_id) { // Check if user and user.user_id are available
        setLoadingAiOnboardingData(true);
        // supabase client is already defined at component scope
        const { data, error } = await supabase
          .from("ai_onboarding_questions")
          .select("questions_data, is_completed") // Fetching the specific fields
          .eq("user_id", user.user_id) // Use user.user_id
          .single();

        if (error && error.code !== "PGRST116") { // PGRST116 means no rows found
          console.error("Error fetching AI onboarding data:", error);
          toast.error("Failed to load AI onboarding data.");
          setAiOnboardingData(null);
        } else {
          setAiOnboardingData(data); // Store the whole data object
        }
        setLoadingAiOnboardingData(false);
      } else {
        // If no user.user_id, it means no onboarding data can be fetched for this relation yet, or user is not loaded
        setLoadingAiOnboardingData(false); // Set to false as we are not fetching
        setAiOnboardingData(null);
      }
    };

    // Only attempt to fetch if user.user_id is present
    if (user?.user_id) {
      fetchAiOnboardingData();
    } else {
      // If user or user.user_id is not yet available, reflect that we're not actively loading onboarding data for a non-existent/unidentified user.
      // This prevents showing "Loading data..." indefinitely if the main user object hasn't loaded its user_id.
      setLoadingAiOnboardingData(false); 
      setAiOnboardingData(null);
    }
  }, [user?.user_id, supabase]); // Depend on user.user_id and supabase client

  const fetchUser = async () => {
    try {
      setLoading(true);
      
      // Fetch user profile
      const { data, error } = await supabase
        .from('business_info')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      setUser(data);
      setEditedUser(data);
      
      
    } catch (error) {
      console.error("Error fetching user:", error);
      toast.error("Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

 

  const handleSave = async () => {
    if (!editedUser) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('business_info')
        .update({
          full_name: editedUser.full_name,
          business_name: editedUser.business_name,
          email: editedUser.email,
          phone_number: editedUser.phone_number,
          payment_option: editedUser.payment_option,
          payment_remaining: editedUser.payment_remaining,
          command_hq_link: editedUser.command_hq_link,
          command_hq_created: editedUser.command_hq_created,
          gd_folder_created: editedUser.gd_folder_created,
          meeting_scheduled: editedUser.meeting_scheduled,
          role: editedUser.role,
          google_review_link: editedUser.google_review_link || null,
        })
        .eq('id', id);
      
      if (error) throw error;
      
      setUser(editedUser);
      setEditMode(false);
      toast.success("User information updated successfully");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user information");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    
    try {
      setIsDeleting(true);
      
      const userId = user.user_id;
      const businessInfoId = user.id;
      
      console.log(`Starting comprehensive deletion for user: ${userId}, business_info: ${businessInfoId}`);
      
      // Step 1: Delete user-specific data (these have CASCADE constraints, but we'll be explicit)
      const deletionSteps = [
        // User-specific data with user_id foreign key
        { table: 'company_onboarding', field: 'user_id', value: userId },
        { table: 'battle_plan', field: 'user_id', value: userId },
        { table: 'chain_of_command', field: 'user_id', value: userId },
        { table: 'hwgt_plan', field: 'user_id', value: userId },
        { table: 'meeting_rhythm_planner', field: 'user_id', value: userId },
        { table: 'playbooks', field: 'user_id', value: userId },
        { table: 'quarterly_sprint_canvas', field: 'user_id', value: userId },
        { table: 'triage_planner', field: 'user_id', value: userId },
        { table: 'user_benefit_claims', field: 'user_id', value: userId },
        { table: 'user_checklist_claims', field: 'user_id', value: userId },
        { table: 'user_timeline_claims', field: 'user_id', value: userId },
        { table: 'machines', field: 'user_id', value: userId },
        { table: 'company_scorecards', field: 'user_id', value: userId },
        { table: 'innovation_documents', field: 'user_id', value: userId },
        { table: 'innovation_chat_history', field: 'user_id', value: userId },
        { table: 'innovation_chat_training_data', field: 'user_id', value: userId },
        { table: 'chat_ideas', field: 'user_id', value: userId },
        { table: 'chatbot_instructions', field: 'user_id', value: userId },
        { table: 'zapier_webhooks', field: 'user_id', value: userId },
        { table: 'zapier_mappings', field: 'user_id', value: userId },
        { table: 'google_analytics_oauth', field: 'user_id', value: userId },
        { table: 'cache', field: 'user_id', value: userId },
        { table: 'user_points', field: 'user_id', value: userId },
        { table: 'user_achievements', field: 'user_id', value: userId },
        
        // Business info related data
        { table: 'playbook_assignments', field: 'user_id', value: businessInfoId },
        
        // Team-related data (if user is a team admin)
        { table: 'departments', field: 'team_id', value: userId },
        { table: 'course_progress', field: 'team_id', value: userId },
        { table: 'course_assignments', field: 'team_id', value: userId },
        
        // Analytics assignments
        { table: 'superadmin_analytics_assignments', field: 'superadmin_user_id', value: userId },
        { table: 'superadmin_analytics_assignments', field: 'assigned_user_id', value: userId },
        { table: 'superadmin_analytics_properties', field: 'superadmin_user_id', value: userId },
      ];
      
      // Execute deletions
      for (const step of deletionSteps) {
        try {
          const { error } = await supabase
            .from(step.table)
            .delete()
            .eq(step.field, step.value);
          
          if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            console.warn(`Warning deleting from ${step.table}:`, error);
          } else {
            console.log(`Successfully deleted from ${step.table}`);
          }
        } catch (error) {
          console.warn(`Error deleting from ${step.table}:`, error);
          // Continue with other deletions even if one fails
        }
      }
      
      // Step 2: Update team members to remove this user as their team admin
      try {
        const { error: teamUpdateError } = await supabase
          .from('business_info')
          .update({ team_id: null })
          .eq('team_id', userId);
        
        if (teamUpdateError) {
          console.warn('Warning updating team members:', teamUpdateError);
        } else {
          console.log('Successfully updated team members');
        }
      } catch (error) {
        console.warn('Error updating team members:', error);
      }
      
      // Step 3: Update users who have this user as their manager
      try {
        const { error: managerUpdateError } = await supabase
          .from('business_info')
          .update({ manager_id: null })
          .eq('manager_id', businessInfoId);
        
        if (managerUpdateError) {
          console.warn('Warning updating manager relationships:', managerUpdateError);
        } else {
          console.log('Successfully updated manager relationships');
        }
      } catch (error) {
        console.warn('Error updating manager relationships:', error);
      }
      
      // Step 4: Finally delete the business_info record
      const { error: businessError } = await supabase
        .from('business_info')
        .delete()
        .eq('id', businessInfoId);
      
      if (businessError) throw businessError;
      
      // Step 5: Delete the user from auth.users using admin API
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No session token available');
        }

        const response = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ userId })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.warn('Warning: Could not delete user from auth system:', errorData);
          // Continue anyway since we've already deleted all the data
        } else {
          console.log('Successfully deleted user from auth system');
        }
      } catch (error) {
        console.warn('Error deleting user from auth system:', error);
        // Continue anyway since we've already deleted all the data
      }
      
      toast.success("User and all related data deleted successfully from the system");
      router.push("/admin/users");
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user. Some data may have been partially deleted.");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editedUser) return;
    const { name, value } = e.target;
    setEditedUser(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    if (!editedUser) return;
    setEditedUser(prev => prev ? { ...prev, [name]: checked } : null);
  };

  const handleSelectChange = (name: string, value: string) => {
    if (!editedUser) return;
    setEditedUser(prev => prev ? { ...prev, [name]: value } : null);
  };

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

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="text-xl font-semibold">User Not Found</h2>
        <p className="text-muted-foreground">The requested user could not be found.</p>
        <Button asChild>
          <Link href="/admin/users">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Users
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/admin/users">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">User Profile</h1>
            <p className="text-muted-foreground">
              View and manage user information
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => {
                setEditMode(false);
                setEditedUser(user);
              }} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditMode(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => {
                      setDropdownOpen(false);
                      router.push(`/admin/users/${user.id}/reset-password`);
                    }}
                    className="cursor-pointer"
                  >
                    <UserCircle className="w-4 h-4 mr-2" />
                    <span>Reset Password</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      setDropdownOpen(false);
                      // Use setTimeout to ensure dropdown closes before dialog opens
                      setTimeout(() => setIsDeleteDialogOpen(true), 0);
                    }}
                    className="text-red-600 cursor-pointer"
                  >
                    <AlertCircle className="w-4 h-4 mr-2" />
                    <span>Delete User</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Delete User Dialog - moved outside of DropdownMenu to prevent focus conflicts */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Delete User Account
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p className="font-medium text-red-600 pt-2 ">
                This action cannot be undone and will permanently delete:
              </p>
              
              <p className="text-xs text-muted-foreground mt-3">
                Note: The user will be completely removed from the system including their authentication account.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting All Data...
                </>
              ) : (
                "Delete User & All Data"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - User Profile */}
        <div className="xl:col-span-1 space-y-6">
          <Card className="overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage src={user.profile_picture_url || ""} alt={user.full_name} />
                <AvatarFallback className={getRandomColor(user.id)}>
                  {getInitials(user.full_name)}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-semibold">{user.full_name}</h2>
             
              <p className="text-muted-foreground mt-1 text-sm">{user.email}</p>
              <p className="text-muted-foreground text-sm">{user.phone_number}</p>
              
              <Separator className="my-4" />
              
              <div className="w-full space-y-4 text-left">
                <div>
                  <p className="text-sm font-medium">Business</p>
                  <p className="text-muted-foreground">{user.business_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Member Since</p>
                  <p className="text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Last Updated</p>
                  <p className="text-muted-foreground">{new Date(user.updated_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">User ID</p>
                  <p className="text-muted-foreground text-xs truncate">{user.user_id}</p>
                </div>
              </div>
            </div>
          </Card>
          
          <Card>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-medium">Setup Status</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full ${user.command_hq_created ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                    <span className="text-sm">Command HQ Created</span>
                  </div>
                  {editMode ? (
                    <Switch
                      checked={editedUser?.command_hq_created || false}
                      onCheckedChange={(checked) => handleSwitchChange("command_hq_created", checked)}
                    />
                  ) : (
                    <Badge variant="outline">
                      {user.command_hq_created ? 'Yes' : 'No'}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full ${user.gd_folder_created ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                    <span className="text-sm">GD Folder Created</span>
                  </div>
                  {editMode ? (
                    <Switch
                      checked={editedUser?.gd_folder_created || false}
                      onCheckedChange={(checked) => handleSwitchChange("gd_folder_created", checked)}
                    />
                  ) : (
                    <Badge variant="outline">
                      {user.gd_folder_created ? 'Yes' : 'No'}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full ${user.meeting_scheduled ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                    <span className="text-sm">Meeting Scheduled</span>
                  </div>
                  {editMode ? (
                    <Switch
                      checked={editedUser?.meeting_scheduled || false}
                      onCheckedChange={(checked) => handleSwitchChange("meeting_scheduled", checked)}
                    />
                  ) : (
                    <Badge variant="outline">
                      {user.meeting_scheduled ? 'Yes' : 'No'}
                    </Badge>
                  )}
                </div>
              </div>
              
              {editMode && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="command_hq_link">Command HQ Link</Label>
                  <Input
                    id="command_hq_link"
                    name="command_hq_link"
                    placeholder="https://..."
                    value={editedUser?.command_hq_link || ""}
                    onChange={handleInputChange}
                  />
                </div>
              )}
              
              {!editMode && user.command_hq_link && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm">Command HQ Link</span>
                  <Button variant="link" className="h-auto p-0 text-blue-600" asChild>
                    <a href={user.command_hq_link} target="_blank" rel="noopener noreferrer">
                      <LinkIcon className="w-3 h-3 mr-1" />
                      Open
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column - Additional Information */}
        <div className="xl:col-span-2 space-y-6">
          {/* Company Onboarding and Account Statistics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Company Onboarding */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Company Onboarding
                </h3>
                <div className="text-center">
                  {loadingOnboardingData ? (
                    <p className="text-muted-foreground">Loading data...</p>
                  ) : onboardingData && onboardingData.onboarding_data ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setIsOnboardingModalOpen(true)}
                    >
                      View Onboarding Data
                    </Button>
                  ) : (
                    <p className="text-muted-foreground">No onboarding data submitted.</p>
                  )}
                  
                  {/* AI Onboarding Questions Button */}
                  <div className="mt-3">
                    {loadingAiOnboardingData ? (
                      <p className="text-muted-foreground text-sm">Loading AI data...</p>
                    ) : aiOnboardingData && aiOnboardingData.questions_data ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setIsAiOnboardingModalOpen(true)}
                      >
                        View AI Onboarding Questions
                      </Button>
                    ) : (
                      <p className="text-muted-foreground text-sm">No AI onboarding questions.</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Account Statistics */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Account Statistics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.floor((new Date().getTime() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))}
                    </div>
                    <div className="text-sm text-muted-foreground">Days Active</div>
                  </div>
                  
                </div>
              </div>
            </Card>
          </div>

          {/* Payment Information */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Payment Option</Label>
                  {editMode ? (
                    <Select
                      value={editedUser?.payment_option || ""}
                      onValueChange={(value) => handleSelectChange("payment_option", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annually">Annually</SelectItem>
                        <SelectItem value="one-time">One Time</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-muted-foreground mt-1">{user.payment_option || "Not specified"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium">Payment Remaining</Label>
                  {editMode ? (
                    <Input
                      type="number"
                      name="payment_remaining"
                      value={editedUser?.payment_remaining || 0}
                      onChange={handleInputChange}
                      placeholder="0"
                    />
                  ) : (
                    <p className="text-muted-foreground mt-1">${user.payment_remaining || 0}</p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Contact Information */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Full Name</Label>
                  {editMode ? (
                    <Input
                      name="full_name"
                      value={editedUser?.full_name || ""}
                      onChange={handleInputChange}
                      placeholder="Enter full name"
                    />
                  ) : (
                    <p className="text-muted-foreground mt-1">{user.full_name}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium">Email Address</Label>
                  {editMode ? (
                    <Input
                      type="email"
                      name="email"
                      value={editedUser?.email || ""}
                      onChange={handleInputChange}
                      placeholder="Enter email address"
                    />
                  ) : (
                    <p className="text-muted-foreground mt-1">{user.email}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium">Phone Number</Label>
                  {editMode ? (
                    <Input
                      name="phone_number"
                      value={editedUser?.phone_number || ""}
                      onChange={handleInputChange}
                      placeholder="Enter phone number"
                    />
                  ) : (
                    <p className="text-muted-foreground mt-1">{user.phone_number}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium">Business Name</Label>
                  {editMode ? (
                    <Input
                      name="business_name"
                      value={editedUser?.business_name || ""}
                      onChange={handleInputChange}
                      placeholder="Enter business name"
                    />
                  ) : (
                    <p className="text-muted-foreground mt-1">{user.business_name}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Label className="text-sm font-medium">Google Review Link</Label>
                  {editMode ? (
                    <Input
                      name="google_review_link"
                      type="url"
                      value={editedUser?.google_review_link || ""}
                      onChange={handleInputChange}
                      placeholder="https://g.page/r/..."
                    />
                  ) : (
                    <div className="mt-1">
                      {user.google_review_link ? (
                        <a 
                          href={user.google_review_link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-blue-600 hover:underline flex items-center gap-1.5 max-w-fit"
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[300px] md:max-w-[500px]">
                            {user.google_review_link}
                          </span>
                        </a>
                      ) : (
                        <p className="text-muted-foreground italic text-sm">Not set</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <CheckSquare className="w-5 h-5" />
                Quick Actions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button variant="outline" className="justify-start" asChild>
                  <Link href={`/admin/users/${user.id}/reset-password`}>
                    <UserCircle className="w-4 h-4 mr-2" />
                    Reset Password
                  </Link>
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Delete User
                </Button>
              </div>
            </div>
          </Card>

          {/* Global Services Assignment */}
          <GlobalServiceAssignment userId={user.user_id} />
        </div>
      </div>

      {/* Add the Modal components here, within the main return structure */}
      <OnboardingDataModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        data={onboardingData?.onboarding_data} // Pass the actual JSONB data
        companyName={user?.business_name || "Company"} // Changed from userName to companyName, using business_name
      />

      <AiOnboardingQuestionsModal
        isOpen={isAiOnboardingModalOpen}
        onClose={() => setIsAiOnboardingModalOpen(false)}
        data={aiOnboardingData?.questions_data} // Pass the actual JSONB data
        companyName={user?.business_name || "Company"} // Using business_name
      />

    </div>
  );
}
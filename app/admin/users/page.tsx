"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, User, CheckSquare, Calendar, Gift, BarChart4 } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export default function UserManagementPage() {
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
  const supabase = createClient();

  // Fetch users on load
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch user profiles from business_info table
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
      
      setUsers(profiles);
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
      const formattedTimeline = timeline?.map(item => ({
        id: item.id,
        event_name: item.event_name,
        week_number: item.week_number,
        description: item.description,
        is_completed: item.user_timeline_claims.length > 0 ? item.user_timeline_claims[0].is_completed : false,
        completion_date: item.user_timeline_claims.length > 0 ? item.user_timeline_claims[0].completion_date : null,
      })) || [];

      const formattedChecklist = checklist?.map(item => ({
        id: item.id,
        checklist_item: item.checklist_item,
        description: item.description,
        is_completed: item.user_checklist_claims.length > 0 ? item.user_checklist_claims[0].is_completed : false,
        completion_date: item.user_checklist_claims.length > 0 ? item.user_checklist_claims[0].completion_date : null,
      })) || [];

      const formattedBenefits = benefits?.map(item => ({
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

  const handleViewDetails = (user: UserProfile) => {
    setSelectedUser(user);
    if (user.user_id) {
      fetchUserDetails(user.user_id);
    }
    setIsDialogOpen(true);
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

  const filteredUsers = searchTerm
    ? users.filter(
        (user) =>
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.business_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : users;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage user accounts and view their data</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 hidden">
        <Card className="p-4 flex items-center space-x-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <User className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Users</p>
            <h3 className="text-2xl font-semibold">{users.length}</h3>
          </div>
        </Card>
        
        <Card className="p-4 flex items-center space-x-4">
          <div className="bg-green-100 p-2 rounded-lg">
            <CheckSquare className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Active Users</p>
            <h3 className="text-2xl font-semibold">{users.filter(u => u.command_hq_created).length}</h3>
          </div>
        </Card>
        
        <Card className="p-4 flex items-center space-x-4">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Calendar className="h-6 w-6 text-purple-700" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Recent Joins</p>
            <h3 className="text-2xl font-semibold">
              {users.filter(u => {
                const date = new Date(u.created_at);
                const now = new Date();
                const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                return diffDays < 30;
              }).length}
            </h3>
          </div>
        </Card>
        
        <Card className="p-4 flex items-center space-x-4">
          <div className="bg-yellow-100 p-2 rounded-lg">
            <BarChart4 className="h-6 w-6 text-yellow-700" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Companies</p>
            <h3 className="text-2xl font-semibold">
              {new Set(users.map(u => u.business_name).filter(Boolean)).size}
            </h3>
          </div>
        </Card>
      </div>

      {/* User Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "No users matching your search" : "No users found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.profile_picture_url || ""} alt={user.full_name} />
                      <AvatarFallback className={getRandomColor(user.id)}>
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.business_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(user)}>
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage 
                  src={selectedUser?.profile_picture_url || ""} 
                  alt={selectedUser?.full_name || "User"} 
                />
                <AvatarFallback className={selectedUser ? getRandomColor(selectedUser.id) : ""}>
                  {getInitials(selectedUser?.full_name)}
                </AvatarFallback>
              </Avatar>
              <span>{selectedUser?.full_name}</span>
            </DialogTitle>
          </DialogHeader>
          
          {detailsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
          ) : (
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="checklist">Checklist</TabsTrigger>
                <TabsTrigger value="benefits">Benefits</TabsTrigger>
              </TabsList>
              
              <TabsContent value="profile" className="space-y-4">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Business Information</h3>
                  {selectedUser ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Business Name</p>
                        <p className="font-medium">{selectedUser.business_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Contact Name</p>
                        <p className="font-medium">{selectedUser.full_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Contact Email</p>
                        <p className="font-medium">{selectedUser.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Contact Phone</p>
                        <p className="font-medium">{selectedUser.phone_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Payment Option</p>
                        <p className="font-medium">{selectedUser.payment_option}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Payment Remaining</p>
                        <p className="font-medium">${selectedUser.payment_remaining?.toFixed(2) || '0.00'}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No business information provided</p>
                  )}
                </Card>
                
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Setup Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Command HQ Created</p>
                      <Badge className={selectedUser?.command_hq_created ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {selectedUser?.command_hq_created ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Command HQ Link</p>
                      <p className="font-medium truncate">{selectedUser?.command_hq_link || 'Not available'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Google Drive Folder Created</p>
                      <Badge className={selectedUser?.gd_folder_created ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {selectedUser?.gd_folder_created ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Initial Meeting Scheduled</p>
                      <Badge className={selectedUser?.meeting_scheduled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {selectedUser?.meeting_scheduled ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Account Created</p>
                      <p className="font-medium">{selectedUser ? new Date(selectedUser.created_at).toLocaleString() : "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">User ID</p>
                      <p className="font-medium text-xs truncate">{selectedUser?.user_id}</p>
                    </div>
                  </div>
                </Card>
              </TabsContent>
              
              <TabsContent value="timeline" className="space-y-4">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Timeline Progress
                    <Badge variant="outline" className="ml-2">
                      {userDetails.timeline.filter(item => item.is_completed).length}/{userDetails.timeline.length} Completed
                    </Badge>
                  </h3>
                  
                  {userDetails.timeline.length === 0 ? (
                    <p className="text-muted-foreground">No timeline events found</p>
                  ) : (
                    <div className="space-y-4">
                      {userDetails.timeline.map((event) => (
                        <div key={event.id} className="flex items-start gap-3 pb-4 border-b">
                          <div className={`rounded-full w-8 h-8 flex items-center justify-center ${event.is_completed ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                            {event.week_number}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{event.event_name}</p>
                              {event.is_completed && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Completed</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {event.description || 'No description available'}
                            </p>
                            {event.completion_date && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Completed on: {new Date(event.completion_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </TabsContent>
              
              <TabsContent value="checklist" className="space-y-4">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Build Checklist
                    <Badge variant="outline" className="ml-2">
                      {userDetails.checklist.filter(item => item.is_completed).length}/{userDetails.checklist.length} Completed
                    </Badge>
                  </h3>
                  
                  {userDetails.checklist.length === 0 ? (
                    <p className="text-muted-foreground">No checklist items found</p>
                  ) : (
                    <div className="space-y-3">
                      {userDetails.checklist.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 pb-3 border-b">
                          <div className={`flex-shrink-0 w-5 h-5 rounded-full ${item.is_completed ? 'bg-green-500' : 'border-2 border-gray-300'}`}>
                            {item.is_completed && <CheckSquare className="w-5 h-5 text-white" />}
                          </div>
                          <div>
                            <span className={item.is_completed ? 'line-through text-muted-foreground' : ''}>
                              {item.checklist_item}
                            </span>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.description}
                              </p>
                            )}
                            {item.completion_date && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Completed on: {new Date(item.completion_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </TabsContent>
              
              <TabsContent value="benefits" className="space-y-4">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Available Benefits
                    <Badge variant="outline" className="ml-2">
                      {userDetails.benefits.filter(item => item.is_claimed).length}/{userDetails.benefits.length} Claimed
                    </Badge>
                  </h3>
                  
                  {userDetails.benefits.length === 0 ? (
                    <p className="text-muted-foreground">No benefits found</p>
                  ) : (
                    <div className="space-y-4">
                      {userDetails.benefits.map((benefit) => (
                        <div key={benefit.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">{benefit.benefit_title}</h4>
                              {benefit.benefit_description && (
                                <p className="text-sm text-muted-foreground mt-1">{benefit.benefit_description}</p>
                              )}
                              {benefit.claimed_date && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Claimed on: {new Date(benefit.claimed_date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <Badge className={benefit.is_claimed ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-100'}>
                              {benefit.is_claimed ? 'Claimed' : 'Not Claimed'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 
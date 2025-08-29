"use client";

import { useState, useEffect } from "react";
import { format, parseISO, getYear, getMonth, getDaysInMonth, getDay } from "date-fns";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Info, Plus, Trash2, Eye, Edit, ChevronRight, ChevronLeft, SquareCode, Users, Settings, CheckCircle, Check, X, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getTeamMemberIds } from "@/utils/supabase/teams";

type Meeting = {
  id: string;
  user_id?: string;
  meeting_type: string;
  meeting_date: string;
  meeting_title: string;
  meeting_description: string;
  meeting_color: string;
  // Leave properties
  leave_type?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  duration_days?: number;
  user_name?: string;
  description?: string;
  selected_user_id?: string; // For team member selection
};

type TeamMember = {
  user_id: string;
  full_name: string;
  color: string;
};

type MeetingDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (meeting: Partial<Meeting>) => void;
  onSaveLeave?: (leave: any) => void;
  onDelete?: (id: string) => void;
  onEdit?: () => void;
  meeting?: Meeting;
  isLoading: boolean;
  viewOnly?: boolean;
  teamMemberColors?: Map<string, string>;
};

type LeaveSummaryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  leaves: any[];
  teamMemberColors: Map<string, string>;
  onViewLeave: (leave: any) => void;
};

const MEETING_TYPES = [
  { id: "quarterly_sprint_planning", name: "Quarterly Sprint Planning", color: "#C8E6C9" },
  { id: "all_hands", name: "All Hands", color: "#BBDEFB" },
  { id: "holidays", name: "Holidays", color: "#263238" },
  { id: "monthly_business_review", name: "Monthly Business Review", color: "#FFF9C4" },
  { id: "weekly_pulse", name: "Weekly Pulse", color: "#E1BEE7" },
  { id: "others", name: "Others", color: "#FF9800" },
];

const LEAVE_TYPE = { id: "leave", name: "Leave", color: "#4CAF50" };
const BANK_HOLIDAY_TYPE = { id: "bank_holiday", name: "Bank Holiday", color: "#9CA3AF" };

// Generate colors for team members
const TEAM_MEMBER_COLORS = [
  "#4CAF50", "#2196F3", "#FF9800", "#9C27B0", "#F44336", 
  "#00BCD4", "#FF5722", "#795548", "#607D8B", "#E91E63",
  "#3F51B5", "#009688", "#FFEB3B", "#8BC34A", "#FFC107"
];

const MeetingDialog = ({ isOpen, onClose, onSave, onSaveLeave, onDelete, onEdit, meeting, isLoading, viewOnly = false, teamMemberColors }: MeetingDialogProps) => {
  const [formData, setFormData] = useState<Partial<Meeting>>({
    meeting_type: "",
    meeting_date: format(new Date(), "yyyy-MM-dd"),
    meeting_title: "",
    meeting_description: "",
    meeting_color: "",
  });
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>('user');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [leaveEntitlementInfo, setLeaveEntitlementInfo] = useState<any>(null);
  const [isCheckingEntitlement, setIsCheckingEntitlement] = useState<boolean>(false);

  const isLeave = meeting?.leave_type || formData.leave_type;

  // Function to fetch leave entitlement information
  const fetchLeaveEntitlementInfo = async (userId: string) => {
    setIsCheckingEntitlement(true);
    try {
      const supabase = createClient();
      const currentYear = new Date().getFullYear();
      
      const { data: leaveInfo } = await supabase.rpc('calculate_remaining_leave_days', {
        p_user_id: userId,
        p_year: currentYear
      });

      if (leaveInfo && leaveInfo[0]) {
        setLeaveEntitlementInfo(leaveInfo[0]);
      }
    } catch (error) {
      console.error("Error fetching leave entitlement info:", error);
    } finally {
      setIsCheckingEntitlement(false);
    }
  };

  // Fetch team members and user role when dialog opens
  useEffect(() => {
    const fetchTeamMembersAndRole = async () => {
      if (isOpen && isLeave) {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user) return;

          // Get current user's role and team info
          const { data: userInfo, error: userError } = await supabase
            .from('business_info')
            .select('role, team_id')
            .eq('user_id', user.id)
            .single();

          if (userError) {
            console.error("Error fetching user info:", userError);
            return;
          }

          const role = userInfo.role || 'user';
          setCurrentUserRole(role);
          setIsAdmin(role === 'admin');

          // If admin, fetch team members
          if (role === 'admin' && userInfo.team_id) {
            const { data: teamMembersData, error: teamError } = await supabase
              .from('business_info')
              .select('user_id, full_name')
              .eq('team_id', userInfo.team_id)
              .order('full_name', { ascending: true });

            if (teamError) {
              console.error("Error fetching team members:", teamError);
              return;
            }

            // Use the teamMemberColors Map passed from parent component for consistent colors
            const membersWithColors = (teamMembersData || []).map((member: { user_id: string; full_name: string }) => ({
              user_id: member.user_id,
              full_name: member.full_name,
              color: teamMemberColors?.get(member.user_id) || TEAM_MEMBER_COLORS[0] // Fallback to first color if not found
            }));

            setTeamMembers(membersWithColors);
          }

          // Fetch leave entitlement info for the current user or selected user
          if (isLeave) {
            const userIdForEntitlement = formData.selected_user_id || user.id;
            await fetchLeaveEntitlementInfo(userIdForEntitlement);
          }
        } catch (error) {
          console.error("Error fetching team members:", error);
        }
      }
    };

    fetchTeamMembersAndRole();
  }, [isOpen, isLeave, formData.selected_user_id, teamMemberColors]);

  useEffect(() => {
    if (meeting) {
      setFormData({
        id: meeting.id,
        meeting_type: meeting.meeting_type,
        meeting_date: meeting.meeting_date,
        meeting_title: meeting.meeting_title,
        meeting_description: meeting.meeting_description,
        meeting_color: meeting.meeting_color,
        // Include leave properties
        leave_type: meeting.leave_type,
        start_date: meeting.start_date,
        end_date: meeting.end_date,
        status: meeting.status,
        duration_days: meeting.duration_days,
        description: meeting.description,
        selected_user_id: meeting.user_id, // Set the selected user for editing
      });
    } else {
      setFormData({
        meeting_type: "",
        meeting_date: format(new Date(), "yyyy-MM-dd"),
        meeting_title: "",
        meeting_description: "",
        meeting_color: "",
        // Default leave properties
        leave_type: "",
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: format(new Date(), "yyyy-MM-dd"),
        status: "pending",
        duration_days: 1,
        description: "",
        selected_user_id: "", // Will be set to current user for non-admin users
      });
    }
  }, [meeting, isOpen]);

  const handleChange = (name: string, value: string | number) => {
    setFormData({ ...formData, [name]: value });

    // Set color automatically based on meeting type
    if (name === "meeting_type" && typeof value === "string") {
      const selectedType = MEETING_TYPES.find(type => type.id === value);
      if (selectedType) {
        setFormData(prev => ({ ...prev, [name]: value, meeting_color: selectedType.color }));
      }
    }

    // Calculate duration when dates change for leaves
    if (name === "start_date" || name === "end_date") {
      const startDate = name === "start_date" ? value : formData.start_date;
      const endDate = name === "end_date" ? value : formData.end_date;
      
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setFormData(prev => ({ ...prev, [name]: value, duration_days: diffDays }));
      }
    }

    // Fetch entitlement info when selected user changes
    if (name === "selected_user_id" && typeof value === "string" && isLeave) {
      const fetchEntitlementForUser = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const userIdForEntitlement = value || user.id;
          fetchLeaveEntitlementInfo(userIdForEntitlement);
        }
      };
      fetchEntitlementForUser();
    }
  };

  const handleSubmit = () => {
    if (isLeave && onSaveLeave) {
      // Check if there's sufficient leave entitlement
      if (leaveEntitlementInfo && formData.duration_days && formData.duration_days > leaveEntitlementInfo.remaining_days) {
        // Don't submit if insufficient leave
        return;
      }

      // For leaves, we need to call the leave save function
      const leaveData = {
        id: formData.id,
        leave_type: formData.leave_type || "leave", // Ensure leave_type is always set
        start_date: formData.start_date,
        end_date: formData.end_date,
        status: formData.status || "pending",
        duration_days: formData.duration_days || 1,
        description: formData.description || "",
        selected_user_id: formData.selected_user_id, // Include selected user ID
      };
      onSaveLeave(leaveData);
    } else {
      onSave(formData);
    }
  };

  // Get meeting type name for displaying in view mode
  const getMeetingTypeName = (typeId: string) => {
    const meetingType = MEETING_TYPES.find(type => type.id === typeId);
    return meetingType?.name || typeId;
  };

  // Get meeting type color
  const getMeetingTypeColor = (typeId: string) => {
    const meetingType = MEETING_TYPES.find(type => type.id === typeId);
    return meetingType?.color || "#e0e0e0";
  };

  if (viewOnly && meeting) {
    if (isLeave) {
      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="sm:max-w-[450px] rounded-xl p-0 overflow-hidden border-none shadow-lg">
            <DialogHeader className="sr-only">
              <DialogTitle>{meeting.user_name || "Leave Request"}</DialogTitle>
            </DialogHeader>
            <div 
              className="py-5 px-6" 
              style={{
                backgroundColor: (teamMemberColors && meeting.user_id) ? teamMemberColors.get(meeting.user_id) || LEAVE_TYPE.color : LEAVE_TYPE.color,
                color: "white"
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{meeting.user_name || "Leave Request"}</h2>
                  <p className="text-sm opacity-80 mt-1">
                    {format(new Date(meeting.start_date || ""), "MMM d")} - {format(new Date(meeting.end_date || ""), "MMM d, yyyy")}
                  </p>
                </div>
                <Badge 
                  className="text-xs font-medium py-1 px-2"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.25)",
                    backdropFilter: "blur(4px)",
                    color: "white"
                  }}
                >
                  {LEAVE_TYPE.name}
                </Badge>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Duration</h3>
                  <p className="text-sm text-gray-800">{meeting.duration_days} day(s)</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
                  <p className="text-sm text-gray-800">{meeting.status}</p>
                </div>
              </div>
              {meeting.description && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
                  <p className="text-sm text-gray-800">{meeting.description}</p>
                </div>
              )}
            </div>
            
            <div className="py-3 px-6 flex justify-between items-center border-t border-gray-100">
              {onDelete && (
                <Button 
                  variant="ghost" 
                  onClick={() => onDelete(meeting.id)}
                  disabled={isLoading}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={onClose} size="sm" className="rounded-lg">
                  Close
                </Button>
                {onEdit && (
                  <Button onClick={onEdit} size="sm" className="bg-blue-600 hover:bg-blue-700 rounded-lg">
                    <Edit className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      );
    }

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[450px] rounded-xl p-0 overflow-hidden border-none shadow-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>{meeting.meeting_title || getMeetingTypeName(meeting.meeting_type)}</DialogTitle>
          </DialogHeader>
          <div 
            className="py-5 px-6" 
            style={{
              backgroundColor: meeting.meeting_color,
              color: meeting.meeting_color === "#263238" ? "white" : "black"
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{meeting.meeting_title || getMeetingTypeName(meeting.meeting_type)}</h2>
                <p className="text-sm opacity-80 mt-1">{format(new Date(meeting.meeting_date), "EEEE, MMMM d, yyyy")}</p>
              </div>
              <Badge 
                className="text-xs font-medium py-1 px-2"
                style={{
                  backgroundColor: "rgba(255,255,255,0.25)",
                  backdropFilter: "blur(4px)",
                  color: meeting.meeting_color === "#263238" ? "white" : "black"
                }}
              >
                {getMeetingTypeName(meeting.meeting_type)}
              </Badge>
            </div>
          </div>
          
          <div className="p-6">
            {meeting.meeting_description && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
                <p className="text-sm text-gray-800">{meeting.meeting_description}</p>
              </div>
            )}
          </div>
          
          <div className="py-3 px-6 flex justify-between items-center border-t border-gray-100">
            {onDelete && (
              <Button 
                variant="ghost" 
                onClick={() => onDelete(meeting.id)}
                disabled={isLoading}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={onClose} size="sm" className="rounded-lg">
                Close
              </Button>
              {onEdit && (
                <Button onClick={onEdit} size="sm" className="bg-blue-600 hover:bg-blue-700 rounded-lg">
                  <Edit className="mr-2 h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] rounded-lg p-0 overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b border-gray-100">
          <DialogTitle>{meeting ? (isLeave ? "Edit Leave Request" : "Edit Meeting") : (isLeave ? "Add Leave Request" : "Add Meeting")}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4 space-y-5">
          {isLeave ? (
            <>
              {/* Team Member Selection - Only show for admin users */}
              {isAdmin && teamMembers.length > 0 && (
                <div className="space-y-1">
                  <Label htmlFor="selected_user_id" className="text-sm font-medium">
                    Team Member
                  </Label>
                  <CustomDropdown
                    value={formData.selected_user_id || ""}
                    onChange={(value) => handleChange("selected_user_id", value)}
                    placeholder="Select team member"
                    options={teamMembers.map(member => ({ 
                      value: member.user_id, 
                      label: member.full_name, 
                      data: member 
                    }))}
                    renderOption={(option) => {
                      const initials = option.label.split(' ').map((n: string) => n[0]).join('').toUpperCase();
                      return (
                        <div className="flex items-center">
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2" 
                            style={{ backgroundColor: option.data.color }}
                          >
                            {initials}
                          </div>
                          {option.label}
                        </div>
                      );
                    }}
                    renderSelected={(option) => {
                      const initials = option.label.split(' ').map((n: string) => n[0]).join('').toUpperCase();
                      return (
                        <div className="flex items-center">
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2" 
                            style={{ backgroundColor: option.data.color }}
                          >
                            {initials}
                          </div>
                          {option.label}
                        </div>
                      );
                    }}
                    className="w-full"
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="start_date" className="text-sm font-medium">
                    Start Date
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date || ""}
                    onChange={(e) => handleChange("start_date", e.target.value)}
                    className="w-full"
                    min={format(new Date(), "yyyy-MM-dd")}
                  />
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="end_date" className="text-sm font-medium">
                    End Date
                  </Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date || ""}
                    onChange={(e) => handleChange("end_date", e.target.value)}
                    className="w-full"
                    min={formData.start_date || format(new Date(), "yyyy-MM-dd")}
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="duration_days" className="text-sm font-medium">
                  Duration (Days)
                </Label>
                <Input
                  id="duration_days"
                  type="number"
                  value={formData.duration_days || 1}
                  onChange={(e) => handleChange("duration_days", parseInt(e.target.value) || 1)}
                  className="w-full"
                  min="1"
                  max="365"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description (Optional)
                </Label>
                <Input
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) => handleChange("description", e.target.value)}
                  className="w-full"
                  placeholder="Reason for leave..."
                />
              </div>

              {/* Leave Entitlement Information */}
              {isLeave && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">Leave Entitlement</h3>
                    {isCheckingEntitlement && (
                      <Spinner className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                  
                  {leaveEntitlementInfo ? (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Total Entitlement:</span>
                        <span className="ml-2 font-medium">{leaveEntitlementInfo.total_entitlement} days</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Used Leave:</span>
                        <span className="ml-2 font-medium">{leaveEntitlementInfo.used_leave_days} days</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Bank Holidays:</span>
                        <span className="ml-2 font-medium">{leaveEntitlementInfo.bank_holidays} days</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Remaining:</span>
                        <span className={`ml-2 font-medium ${leaveEntitlementInfo.remaining_days < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {leaveEntitlementInfo.remaining_days} days
                        </span>
                      </div>
                    </div>
                  ) : !isCheckingEntitlement ? (
                    <p className="text-sm text-gray-500">No entitlement information available</p>
                  ) : null}

                  {/* Show warning if insufficient leave */}
                  {leaveEntitlementInfo && formData.duration_days && formData.duration_days > leaveEntitlementInfo.remaining_days && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-center">
                        <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                        <span className="text-sm font-medium text-red-800">
                          Insufficient Leave Entitlement
                        </span>
                      </div>
                      <p className="text-sm text-red-700 mt-1">
                        You only have {leaveEntitlementInfo.remaining_days} days remaining, but requesting {formData.duration_days} days.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="meeting_type" className="text-sm font-medium">
                  Meeting Type
                </Label>
                <CustomDropdown
                  value={formData.meeting_type || ""}
                  onChange={(value) => handleChange("meeting_type", value)}
                  placeholder="Select meeting type"
                  options={MEETING_TYPES.map(type => ({ 
                    value: type.id, 
                    label: type.name, 
                    data: type 
                  }))}
                  renderOption={(option) => (
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-sm mr-2" 
                        style={{ backgroundColor: option.data.color }}
                      />
                      {option.label}
                    </div>
                  )}
                  renderSelected={(option) => (
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-sm mr-2" 
                        style={{ backgroundColor: option.data.color }}
                      />
                      {option.label}
                    </div>
                  )}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="meeting_date" className="text-sm font-medium">
                  Date
                </Label>
                <Input
                  id="meeting_date"
                  type="date"
                  value={formData.meeting_date}
                  onChange={(e) => handleChange("meeting_date", e.target.value)}
                  className="w-full"
                  min={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="meeting_title" className="text-sm font-medium">
                  Title
                </Label>
                <Input
                  id="meeting_title"
                  value={formData.meeting_title || ""}
                  onChange={(e) => handleChange("meeting_title", e.target.value)}
                  className="w-full"
                  placeholder="Meeting title (optional)"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="meeting_description" className="text-sm font-medium">
                  Description
                </Label>
                <Input
                  id="meeting_description"
                  value={formData.meeting_description || ""}
                  onChange={(e) => handleChange("meeting_description", e.target.value)}
                  className="w-full"
                  placeholder="Meeting description (optional)"
                />
              </div>
            </>
          )}
        </div>
        
        <DialogFooter className="px-6 py-4 bg-gray-50 flex items-center justify-between">
          {meeting && onDelete && (
            <Button 
              variant="ghost" 
              onClick={() => onDelete(meeting.id)}
              disabled={isLoading}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          )}
          <div className={`flex gap-2 ${meeting && onDelete ? "" : "ml-auto"}`}>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={
                isLoading || 
                (isLeave && leaveEntitlementInfo && formData.duration_days && formData.duration_days > leaveEntitlementInfo.remaining_days)
              } 
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : null}
              {meeting ? "Update" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const LeaveSummaryDialog = ({ isOpen, onClose, date, leaves, teamMemberColors, onViewLeave }: LeaveSummaryDialogProps) => {
  const formatDate = (dateStr: string) => {
    try {
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) {
        return "Invalid Date";
      }
      return format(dateObj, "EEEE, MMMM d, yyyy");
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  };

  const getInitials = (name: string) => {
    return name ? name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'U';
  };

  // Don't render if date is invalid
  if (!date || date === "") {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-xl p-0 overflow-hidden border-none shadow-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Team Members on Leave</DialogTitle>
        </DialogHeader>
        <div 
          className="py-5 px-6" 
          style={{
            backgroundColor: LEAVE_TYPE.color,
            color: "white"
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Team Members on Leave</h2>
              <p className="text-sm opacity-80 mt-1">{formatDate(date)}</p>
            </div>
            <Badge 
              className="text-xs font-medium py-1 px-2"
              style={{
                backgroundColor: "rgba(255,255,255,0.25)",
                backdropFilter: "blur(4px)",
                color: "white"
              }}
            >
              {leaves.length} member{leaves.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
        
        <div className="p-6">
          <div className="space-y-3">
            {leaves.map((leave) => {
              const memberColor = teamMemberColors.get(leave.user_id) || LEAVE_TYPE.color;
              const initials = getInitials(leave.user_name || 'Unknown User');
              
              return (
                <div
                  key={leave.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => onViewLeave(leave)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
                      style={{ backgroundColor: memberColor }}
                    >
                      {initials}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{leave.user_name || 'Unknown User'}</h3>
                      <p className="text-sm text-gray-500">
                        {(() => {
                          try {
                            const startDate = new Date(leave.start_date);
                            const endDate = new Date(leave.end_date);
                            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                              return "Invalid date range";
                            }
                            return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")} (${leave.duration_days} day${leave.duration_days !== 1 ? 's' : ''})`;
                          } catch (error) {
                            return "Invalid date range";
                          }
                        })()}
                      </p>
                      
                      {/* Status Section */}
                      <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-600 font-medium mb-1">Status</div>
                        <div className="text-xs text-gray-700">
                          {leave.current_leave_balance > 0 ? 
                            `${leave.current_leave_balance} days left` : 
                            leave.current_leave_balance === 0 ? 
                              'Leave completed' : 
                              'Calculating...'
                          }
                        </div>
                        
                        {/* Status indicators */}
                        {leave.current_leave_balance === leave.duration_days && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <span className="text-xs text-blue-600 font-medium">About to take leave</span>
                          </div>
                        )}
                        
                        {leave.current_leave_balance === 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="w-2 h-2 rounded-full bg-green-400"></div>
                            <span className="text-xs text-green-600 font-medium">Completed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      className="text-xs"
                      variant={leave.status === 'approved' ? 'default' : 'secondary'}
                    >
                      {leave.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="py-3 px-6 flex justify-end items-center border-t border-gray-100">
          <Button variant="outline" onClick={onClose} size="sm" className="rounded-lg">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function MeetingRhythmPlanner() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [bankHolidays, setBankHolidays] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isViewOnly, setIsViewOnly] = useState<boolean>(false);
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | undefined>(undefined);
  const [showPastMeetings, setShowPastMeetings] = useState<boolean>(false);
  const [showLeaves, setShowLeaves] = useState<boolean>(false);
  const [teamMemberColors, setTeamMemberColors] = useState<Map<string, string>>(new Map());
  const [leaveSummaryDialog, setLeaveSummaryDialog] = useState<{
    isOpen: boolean;
    date: string;
    leaves: any[];
  }>({
    isOpen: false,
    date: "",
    leaves: []
  });
  const [approvalsDialog, setApprovalsDialog] = useState<boolean>(false);
  const [entitlementsDialog, setEntitlementsDialog] = useState<boolean>(false);
  const [teamMembersDialog, setTeamMembersDialog] = useState<boolean>(false);
  const [userLeaveInfo, setUserLeaveInfo] = useState<{
    total_entitlement: number;
    used_leave_days: number;
    bank_holidays: number;
    remaining_days: number;
  } | null>(null);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [entitlements, setEntitlements] = useState<any[]>([]);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalComments, setApprovalComments] = useState('');
  const [selectedLeaveForApproval, setSelectedLeaveForApproval] = useState<any>(null);
  const [entitlementForm, setEntitlementForm] = useState({
    total_entitlement_days: 25,
    year: new Date().getFullYear()
  });
  const [teamMembersDetails, setTeamMembersDetails] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userInfo } = await supabase
        .from('business_info')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const role = userInfo?.role || 'user';
      setIsAdmin(role === 'admin');
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  };

  const fetchMeetings = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No authenticated user");
      
      const teamMemberIds = await getTeamMemberIds(supabase, user.id);

      const { data, error } = await supabase
        .from('meeting_rhythm_planner')
        .select('*')
        .in('user_id', teamMemberIds)
        .gte('meeting_date', `${selectedYear}-01-01`)
        .lte('meeting_date', `${selectedYear}-12-31`)
        .order('meeting_date', { ascending: true });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching meetings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBankHolidays = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_holidays')
        .select('*')
        .eq('year', selectedYear)
        .eq('is_active', true)
        .order('holiday_date', { ascending: true });

      if (error) throw error;
      setBankHolidays(data || []);
    } catch (error: any) {
      console.error("Error fetching bank holidays:", error);
      // Don't show toast for bank holidays as they're not critical
    }
  };

  const fetchUserLeaveInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentYear = new Date().getFullYear();
      const { data: leaveInfo } = await supabase.rpc('calculate_remaining_leave_days', {
        p_user_id: user.id,
        p_year: currentYear
      });

      if (leaveInfo && leaveInfo[0]) {
        setUserLeaveInfo(leaveInfo[0]);
      }
    } catch (error: any) {
      console.error("Error fetching user leave info:", error);
    }
  };

  const fetchPendingLeaves = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userInfo } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', user.id)
        .single();

      if (!userInfo?.team_id) return;

      const teamMemberIds = await getTeamMemberIds(supabase, user.id);

      // Get pending leave requests
      const { data: leaves, error: leavesError } = await supabase
        .from('team_leaves')
        .select('*')
        .in('user_id', teamMemberIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (leavesError) throw leavesError;

      // Get team member names
      const { data: teamMembers, error: teamError } = await supabase
        .from('business_info')
        .select('user_id, full_name')
        .eq('team_id', userInfo.team_id);

      if (teamError) throw teamError;

      // Combine the data
      const leavesWithNames = leaves?.map((leave: any) => {
        const teamMember = teamMembers?.find((m: any) => m.user_id === leave.user_id);
        return {
          ...leave,
          user_name: teamMember?.full_name || 'Unknown User'
        };
      }) || [];

      setPendingLeaves(leavesWithNames);
    } catch (error: any) {
      console.error("Error fetching pending leaves:", error);
    }
  };

  const fetchEntitlements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userInfo } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', user.id)
        .single();

      if (!userInfo?.team_id) return;

      const { data, error } = await supabase
        .from('leave_entitlements')
        .select('*')
        .eq('team_id', userInfo.team_id)
        .order('year', { ascending: false });

      if (error) throw error;
      setEntitlements(data || []);
    } catch (error: any) {
      console.error("Error fetching entitlements:", error);
    }
  };

  const fetchTeamMembersDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userInfo } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', user.id)
        .single();

      if (!userInfo?.team_id) return;

      // Get all team members
      const { data: teamMembers, error: teamError } = await supabase
        .from('business_info')
        .select('user_id, full_name, email')
        .eq('team_id', userInfo.team_id)
        .order('full_name', { ascending: true });

      if (teamError) throw teamError;

      // Get current year
      const currentYear = new Date().getFullYear();

      // Get leave entitlements for the team
      const { data: entitlementsData } = await supabase
        .from('leave_entitlements')
        .select('total_entitlement_days')
        .eq('team_id', userInfo.team_id)
        .eq('year', currentYear)
        .single();

      const totalEntitlement = entitlementsData?.total_entitlement_days || 25;

      // Get all leaves for team members for current year
      const teamMemberIds = teamMembers.map((member: any) => member.user_id);
      const { data: allLeaves, error: leavesError } = await supabase
        .from('team_leaves')
        .select('*')
        .in('user_id', teamMemberIds)
        .gte('start_date', `${currentYear}-01-01`)
        .lte('end_date', `${currentYear}-12-31`)
        .order('start_date', { ascending: true });

      if (leavesError) throw leavesError;

      // Calculate leave details for each team member
      const membersWithDetails = await Promise.all(
        teamMembers.map(async (member: any) => {
          // Get leave entitlement info for this member
          const { data: leaveInfo } = await supabase.rpc('calculate_remaining_leave_days', {
            p_user_id: member.user_id,
            p_year: currentYear
          });

          const memberLeaves = allLeaves?.filter((leave: any) => leave.user_id === member.user_id) || [];
          
          // Calculate statistics
          const approvedLeaves = memberLeaves.filter((leave: any) => leave.status === 'approved');
          const pendingLeaves = memberLeaves.filter((leave: any) => leave.status === 'pending');
          const rejectedLeaves = memberLeaves.filter((leave: any) => leave.status === 'rejected');
          
          const totalDaysTaken = approvedLeaves.reduce((sum: number, leave: any) => sum + (leave.duration_days || 0), 0);
          const totalDaysPending = pendingLeaves.reduce((sum: number, leave: any) => sum + (leave.duration_days || 0), 0);

          return {
            ...member,
            total_entitlement: totalEntitlement,
            used_leave_days: leaveInfo?.[0]?.used_leave_days || 0,
            bank_holidays: leaveInfo?.[0]?.bank_holidays || 0,
            remaining_days: leaveInfo?.[0]?.remaining_days || totalEntitlement,
            total_days_taken: totalDaysTaken,
            total_days_pending: totalDaysPending,
            approved_leaves: approvedLeaves.length,
            pending_leaves: pendingLeaves.length,
            rejected_leaves: rejectedLeaves.length,
            all_leaves: memberLeaves
          };
        })
      );

      setTeamMembersDetails(membersWithDetails);
    } catch (error: any) {
      console.error("Error fetching team members details:", error);
    }
  };

  const fetchLeaves = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No authenticated user");
      
      // First, get the current user's team ID
      const { data: userInfo, error: userError } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', user.id)
        .single();

      if (userError) {
        console.error("Error fetching user info:", userError);
        // Fallback to just the current user
        const { data, error } = await supabase
          .from('team_leaves')
          .select('*')
          .eq('user_id', user.id)
          .gte('start_date', `${selectedYear}-01-01`)
          .lte('end_date', `${selectedYear}-12-31`)
          .order('start_date', { ascending: true });

        if (error) throw error;
        setLeaves(data || []);
        return;
      }

      // Get all team members
      const { data: teamMembers, error: teamError } = await supabase
        .from('business_info')
        .select('user_id, full_name')
        .eq('team_id', userInfo.team_id);

      if (teamError) {
        console.error("Error fetching team members:", teamError);
        // Fallback to just the current user
        const { data, error } = await supabase
          .from('team_leaves')
          .select('*')
          .eq('user_id', user.id)
          .gte('start_date', `${selectedYear}-01-01`)
          .lte('end_date', `${selectedYear}-12-31`)
          .order('start_date', { ascending: true });

        if (error) throw error;
        setLeaves(data || []);
        return;
      }

      const teamMemberIds = teamMembers.map((member: any) => member.user_id).filter((id: any): id is string => id !== null);

      const { data, error } = await supabase
        .from('team_leaves')
        .select('*')
        .in('user_id', teamMemberIds)
        .gte('start_date', `${selectedYear}-01-01`)
        .lte('end_date', `${selectedYear}-12-31`)
        .order('start_date', { ascending: true });

      if (error) throw error;
      
              // Map user names to leaves and assign colors, including leave balance
        const leavesWithNames = await Promise.all(data?.map(async (leave: any) => {
          const teamMember = teamMembers.find((member: any) => member.user_id === leave.user_id);
          
          // Get leave entitlements for the team
          const { data: entitlementsData } = await supabase
            .from('leave_entitlements')
            .select('total_entitlement_days')
            .eq('team_id', userInfo.team_id)
            .eq('year', selectedYear)
            .single();
          
          const totalEntitlement = entitlementsData?.total_entitlement_days || 25;
          
          // Calculate remaining days for this specific leave
          const currentDate = new Date();
          const leaveStartDate = new Date(leave.start_date);
          const leaveEndDate = new Date(leave.end_date);
          
          let remainingDays = 0;
          
          if (currentDate < leaveStartDate) {
            // Leave hasn't started yet - show full duration
            remainingDays = leave.duration_days;
          } else if (currentDate >= leaveStartDate && currentDate <= leaveEndDate) {
            // Leave is ongoing - calculate remaining days
            const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
            const daysFromStart = Math.floor((currentDate.getTime() - leaveStartDate.getTime()) / oneDay);
            remainingDays = Math.max(0, leave.duration_days - daysFromStart);
          } else {
            // Leave has ended - show 0 days remaining
            remainingDays = 0;
          }
          
          return {
            ...leave,
            user_name: teamMember?.full_name || 'Unknown User',
            current_leave_balance: remainingDays,
            total_entitlement: totalEntitlement,
            is_over_limit: remainingDays < 0
          };
        }) || []);
      
      // Create color mapping for team members
      const colorMap = new Map<string, string>();
      teamMembers.forEach((member: any, index: number) => {
        colorMap.set(member.user_id, TEAM_MEMBER_COLORS[index % TEAM_MEMBER_COLORS.length]);
      });
      setTeamMemberColors(colorMap);
      
      setLeaves(leavesWithNames);
    } catch (error: any) {
      console.error("Error fetching leaves:", error);
      toast({
        title: "Error fetching leaves",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    fetchMeetings();
    if (showLeaves) {
      fetchLeaves();
      fetchUserLeaveInfo();
      if (isAdmin) {
        fetchPendingLeaves();
        fetchEntitlements();
        fetchTeamMembersDetails();
    }
    }
  }, [selectedYear, showLeaves, isAdmin]);

  useEffect(() => {
    fetchBankHolidays();
  }, [selectedYear]);

  const handleSaveMeeting = async (meeting: Partial<Meeting>) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No authenticated user");
      
      if (meeting.id) {
        // Update existing meeting
        const { error } = await supabase
          .from('meeting_rhythm_planner')
          .update({
            meeting_type: meeting.meeting_type,
            meeting_date: meeting.meeting_date,
            meeting_title: meeting.meeting_title,
            meeting_description: meeting.meeting_description,
            meeting_color: meeting.meeting_color,
          })
          .eq('id', meeting.id);

        if (error) throw error;
        toast({
          title: "Meeting updated",
          description: "The meeting has been updated successfully.",
        });
      } else {
        // Create new meeting
        const { error } = await supabase
          .from('meeting_rhythm_planner')
          .insert({
            user_id: user.id,
            meeting_type: meeting.meeting_type,
            meeting_date: meeting.meeting_date,
            meeting_title: meeting.meeting_title,
            meeting_description: meeting.meeting_description,
            meeting_color: meeting.meeting_color,
          });

        if (error) throw error;
        toast({
          title: "Meeting created",
          description: "The meeting has been created successfully.",
        });
      }

      fetchMeetings();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error saving meeting",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm("Are you sure you want to delete this meeting?")) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('meeting_rhythm_planner')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({
        title: "Meeting deleted",
        description: "The meeting has been deleted successfully.",
      });
      fetchMeetings();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error deleting meeting",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMeeting = () => {
    setCurrentMeeting(undefined);
    setIsViewOnly(false);
    setIsDialogOpen(true);
  };

  const handleViewMeeting = (meeting: Meeting) => {
    setCurrentMeeting(meeting);
    setIsViewOnly(true);
    setIsDialogOpen(true);
  };

  const handleEditMeeting = () => {
    setIsViewOnly(false);
  };

  const handleSaveLeave = async (leave: any) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No authenticated user");
      
      // Determine which user ID to use for the leave
      let userIdForLeave = user.id; // Default to current user
      
      // If admin is creating leave for someone else, use the selected user ID
      if (leave.selected_user_id) {
        userIdForLeave = leave.selected_user_id;
      }

      // Check leave entitlement for new leave requests
      if (!leave.id) {
        const currentYear = new Date().getFullYear();
        const { data: leaveInfo } = await supabase.rpc('calculate_remaining_leave_days', {
          p_user_id: userIdForLeave,
          p_year: currentYear
        });

        if (leaveInfo && leaveInfo[0]) {
          const remainingDays = leaveInfo[0].remaining_days;
          const requestedDays = leave.duration_days || 1;
          const totalEntitlement = leaveInfo[0].total_entitlement;
          const usedLeave = leaveInfo[0].used_leave_days;
          const bankHolidays = leaveInfo[0].bank_holidays;

          if (requestedDays > remainingDays) {
            toast({
              title: "Insufficient Leave Entitlement",
              description: `Leave entitlement: ${totalEntitlement} days total, ${usedLeave} days used, ${bankHolidays} bank holidays. You only have ${remainingDays} days remaining. You cannot request ${requestedDays} days.`,
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
        }
      }
      
      if (leave.id) {
        // Update existing leave
        const { error } = await supabase
          .from('team_leaves')
          .update({
            leave_type: leave.leave_type || "leave", // Ensure leave_type is always set
            start_date: leave.start_date,
            end_date: leave.end_date,
            status: leave.status || "pending",
            duration_days: leave.duration_days || 1,
            description: leave.description || "",
          })
          .eq('id', leave.id);

        if (error) throw error;
        toast({
          title: "Leave request updated",
          description: "The leave request has been updated successfully.",
        });
      } else {
        // Create new leave
        const { error } = await supabase
          .from('team_leaves')
          .insert({
            user_id: userIdForLeave,
            leave_type: leave.leave_type || "leave", // Ensure leave_type is always set
            start_date: leave.start_date,
            end_date: leave.end_date,
            status: leave.status || "pending",
            duration_days: leave.duration_days || 1,
            description: leave.description || "",
          });

        if (error) throw error;
        toast({
          title: "Leave request created",
          description: "The leave request has been created successfully.",
        });
      }

      fetchLeaves();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error saving leave request",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLeave = async (id: string) => {
    if (!confirm("Are you sure you want to delete this leave request?")) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('team_leaves')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({
        title: "Leave request deleted",
        description: "The leave request has been deleted successfully.",
      });
      fetchLeaves();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error deleting leave request",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproval = async () => {
    if (!selectedLeaveForApproval) return;

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      // Update leave status
      const { error: leaveError } = await supabase
        .from('team_leaves')
        .update({ status: approvalAction === 'approve' ? 'approved' : 'rejected' })
        .eq('id', selectedLeaveForApproval.id);

      if (leaveError) throw leaveError;

      // Create approval record
      const { error: approvalError } = await supabase
        .from('leave_approvals')
        .insert({
          leave_id: selectedLeaveForApproval.id,
          approver_id: user.id,
          action: approvalAction === 'approve' ? 'approved' : 'rejected',
          comments: approvalComments.trim() || null
        });

      if (approvalError) throw approvalError;

      toast({
        title: `Leave ${approvalAction === 'approve' ? 'Approved' : 'Rejected'}`,
        description: `The leave request has been ${approvalAction === 'approve' ? 'approved' : 'rejected'} successfully.`,
      });

      fetchPendingLeaves();
      fetchLeaves();
      setSelectedLeaveForApproval(null);
      setApprovalComments('');
    } catch (error: any) {
      toast({
        title: "Error processing approval",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEntitlement = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const { data: userInfo } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', user.id)
        .single();

      if (!userInfo?.team_id) throw new Error("No team found");

      // Check if entitlement already exists for this year
      const existingEntitlement = entitlements.find(e => e.year === entitlementForm.year);

      if (existingEntitlement) {
        // Update existing entitlement
        const { error } = await supabase
          .from('leave_entitlements')
          .update({
            total_entitlement_days: entitlementForm.total_entitlement_days
          })
          .eq('id', existingEntitlement.id);

        if (error) throw error;
        toast({
          title: "Entitlement updated",
          description: "Leave entitlement has been updated successfully.",
        });
      } else {
        // Create new entitlement
        const { error } = await supabase
          .from('leave_entitlements')
          .insert({
            team_id: userInfo.team_id,
            total_entitlement_days: entitlementForm.total_entitlement_days,
            year: entitlementForm.year
          });

        if (error) throw error;
        toast({
          title: "Entitlement created",
          description: "Leave entitlement has been created successfully.",
        });
      }

      fetchEntitlements();
      setEntitlementForm({
        total_entitlement_days: 25,
        year: new Date().getFullYear()
      });
    } catch (error: any) {
      toast({
        title: "Error saving entitlement",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEntitlement = async (id: string) => {
    if (!confirm("Are you sure you want to delete this entitlement?")) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('leave_entitlements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({
        title: "Entitlement deleted",
        description: "Leave entitlement has been deleted successfully.",
      });
      fetchEntitlements();
    } catch (error: any) {
      toast({
        title: "Error deleting entitlement",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLeave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current user's role
      const { data: userInfo } = await supabase
        .from('business_info')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const isAdmin = userInfo?.role === 'admin';
      
      setCurrentMeeting({
        id: "",
        meeting_type: "",
        meeting_date: "",
        meeting_title: "",
        meeting_description: "",
        meeting_color: "",
        leave_type: "leave",
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: format(new Date(), "yyyy-MM-dd"),
        status: "pending",
        duration_days: 1,
        description: "",
        selected_user_id: isAdmin ? "" : user.id // Set current user for non-admin users
      });
      setIsViewOnly(false);
      setIsDialogOpen(true);
    } catch (error) {
      console.error("Error setting up leave form:", error);
      // Fallback to basic setup
    setCurrentMeeting({
      id: "",
      meeting_type: "",
      meeting_date: "",
      meeting_title: "",
      meeting_description: "",
      meeting_color: "",
      leave_type: "leave",
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: format(new Date(), "yyyy-MM-dd"),
      status: "pending",
      duration_days: 1,
      description: ""
    });
    setIsViewOnly(false);
    setIsDialogOpen(true);
    }
  };

  const handleViewLeave = (leave: any) => {
    setCurrentMeeting(leave);
    setIsViewOnly(true);
    setIsDialogOpen(true);
  };

  const getMeetingsForDate = (year: number, month: number, day: number) => {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return meetings.filter(meeting => meeting.meeting_date === date);
  };

  const getLeavesForDate = (year: number, month: number, day: number) => {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return leaves.filter(leave => {
      const startDate = new Date(leave.start_date);
      const endDate = new Date(leave.end_date);
      const checkDate = new Date(date);
      return checkDate >= startDate && checkDate <= endDate;
    });
  };

  const getBankHolidaysForDate = (year: number, month: number, day: number) => {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return bankHolidays.filter(holiday => holiday.holiday_date === date);
  };

  const getMeetingTypeColor = (type: string) => {
    const meetingType = MEETING_TYPES.find(t => t.id === type);
    return meetingType?.color || "#e0e0e0";
  };

  // Filter meetings based on showPastMeetings toggle
  const getFilteredMeetings = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (showPastMeetings) {
      return meetings;
    } else {
      return meetings.filter(meeting => {
        const meetingDate = new Date(meeting.meeting_date);
        meetingDate.setHours(0, 0, 0, 0);
        return meetingDate >= today;
      });
    }
  };

  const renderCalendar = () => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const daysOfWeek = ["M", "T", "W", "T", "F", "S", "S"];

    // Function to check if a date is a Thursday
    const isThursday = (year: number, month: number, day: number) => {
      // getDay returns 0 for Sunday, so Thursday is 4
      const date = new Date(year, month, day);
      return getDay(date) === 4; // 4 represents Thursday
    };

    // Function to check if a date is a weekend (Saturday or Sunday)
    const isWeekend = (year: number, month: number, day: number) => {
      const date = new Date(year, month, day);
      const dayOfWeek = getDay(date);
      return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
    };

    return (
      <Card className=" border-0 overflow-hidden bg-white">
        <CardHeader className="pb-0 pt-6 px-6">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl font-bold">{selectedYear}</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                onClick={() => setSelectedYear(selectedYear - 1)} 
                variant="outline" 
                size="icon"
                className="h-8 w-8 rounded-full"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                onClick={() => setSelectedYear(selectedYear + 1)} 
                variant="outline" 
                size="icon"
                className="h-8 w-8 rounded-full"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-2 sm:p-4 pt-4">
          <ScrollArea className="h-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 p-1 sm:p-2">
              {months.map((month, monthIndex) => (
                <Card key={month} className="border overflow-hidden rounded-xl bg-gray-50">
                  <CardHeader className="py-1 sm:py-2 px-2 sm:px-3 border-b">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-700 tracking-wide">{month}</h3>
                  </CardHeader>
                  <div className="grid grid-cols-7 text-center text-[8px] sm:text-[10px]">
                    {daysOfWeek.map((day, i) => (
                      <div key={i} className="p-0.5 sm:p-1 border-b font-semibold text-gray-500">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1 p-0.5 sm:p-1 text-[8px] sm:text-xs">
                    {/* Add empty cells for days before the 1st of the month */}
                    {(() => {
                      // Get the day of the week for the 1st day of the month (0 = Sunday, 1 = Monday, etc.)
                      const firstDayOfMonth = new Date(selectedYear, monthIndex, 1);
                      // Convert to 0 = Monday, 1 = Tuesday, etc. (since our grid starts with Monday)
                      let dayOffset = getDay(firstDayOfMonth);
                      // Adjust from Sunday = 0 to Monday = 0
                      dayOffset = dayOffset === 0 ? 6 : dayOffset - 1;
                      
                      // Create empty cells for days before the 1st
                      return Array.from({ length: dayOffset }).map((_, index) => (
                        <div key={`empty-${index}`} className="aspect-square p-0.5 sm:p-1"></div>
                      ));
                    })()}
                    
                    {Array.from({ length: getDaysInMonth(new Date(selectedYear, monthIndex)) }).map((_, day) => {
                      const dayNumber = day + 1;
                      const dateMeetings = showLeaves ? [] : getMeetingsForDate(selectedYear, monthIndex, dayNumber);
                      const dateLeaves = showLeaves ? getLeavesForDate(selectedYear, monthIndex, dayNumber) : [];
                      const dateBankHolidays = getBankHolidaysForDate(selectedYear, monthIndex, dayNumber);
                      const isWeekendDay = isWeekend(selectedYear, monthIndex, dayNumber);
                      const isThursdayDay = isThursday(selectedYear, monthIndex, dayNumber);
                      
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const currentDate = new Date(selectedYear, monthIndex, dayNumber);
                      currentDate.setHours(0, 0, 0, 0);
                      const isPastAndEmpty = currentDate < today && dateMeetings.length === 0 && dateLeaves.length === 0;

                      // Default background for the day cell
                      let bgColor = isWeekendDay ? "bg-gray-50" : "bg-white";
                      let mainMeeting = dateMeetings[0]; // Get the first meeting for this date
                      let mainLeave = dateLeaves[0]; // Get the first leave for this date
                      let mainBankHoliday = dateBankHolidays[0]; // Get the first bank holiday for this date
                      
                      // Thursday default to Weekly Pulse if no other meeting exists (only in meeting mode)
                      if (!showLeaves && isThursdayDay && dateMeetings.length === 0) {
                        const weeklyPulseType = MEETING_TYPES.find(t => t.id === "weekly_pulse");
                        if (weeklyPulseType) {
                          bgColor = `bg-[${weeklyPulseType.color}]`;
                        }
                      }
                      
                      // Bank holidays take highest priority
                      if (mainBankHoliday) {
                        bgColor = `bg-[${BANK_HOLIDAY_TYPE.color}]`;
                      }
                      // If there are leaves, use a neutral background
                      else if (dateLeaves.length > 0) {
                        bgColor = "bg-gray-100";
                      }
                      // If there's a meeting, use its color (only in meeting mode)
                      else if (mainMeeting) {
                        bgColor = `bg-[${mainMeeting.meeting_color}]`;
                      }
                      
                      return (
                        <div
                          key={day}
                          className={`aspect-square p-0.5 sm:p-1 relative transition-all rounded-md transform ${!isPastAndEmpty ? 'cursor-pointer hover:opacity-90 hover:scale-105 hover:z-10 border-2 border-transparent hover:border-gray-200' : 'cursor-not-allowed'}`}
                          onClick={() => {
                            // Allow viewing leaves on any date
                            if (showLeaves && dateLeaves.length > 0) {
                              // Show leave summary dialog with all team members on leave
                              const dateStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                              // Validate the date before setting it
                              const testDate = new Date(dateStr);
                              if (!isNaN(testDate.getTime())) {
                                setLeaveSummaryDialog({
                                  isOpen: true,
                                  date: dateStr,
                                  leaves: dateLeaves
                                });
                              } else {
                                console.error("Invalid date generated:", dateStr);
                              }
                              return;
                            }
                            
                            // Allow viewing meetings on any date
                            if (!showLeaves && dateMeetings.length > 0) {
                              handleViewMeeting(dateMeetings[0]);
                              return;
                            }

                            // Prevent creating meetings on past dates
                            if (isPastAndEmpty) {
                              return;
                            }
                            
                            // Handle future date clicks
                            if (showLeaves) {
                              // If leaves are enabled, create a leave entry
                              const dateStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                              // For now, we'll let the dialog handle user selection
                              setCurrentMeeting({
                                id: "",
                                meeting_type: "",
                                meeting_date: dateStr,
                                meeting_title: "",
                                meeting_description: "",
                                meeting_color: "",
                                leave_type: "leave", // Always set to "leave"
                                start_date: dateStr,
                                end_date: dateStr,
                                status: "pending",
                                duration_days: 1,
                                description: "",
                                selected_user_id: "" // Will be set in the dialog based on user role
                              });
                              setIsViewOnly(false);
                              setIsDialogOpen(true);
                            } else if (isThursdayDay) {
                              // If it's a Thursday with no meeting, create a Weekly Pulse entry
                              const weeklyPulseType = MEETING_TYPES.find(t => t.id === "weekly_pulse");
                              const dateStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                              setCurrentMeeting({
                                id: "",
                                meeting_type: "weekly_pulse",
                                meeting_date: dateStr,
                                meeting_title: "Weekly Pulse",
                                meeting_description: "Regular weekly meeting",
                                meeting_color: weeklyPulseType?.color || "#E1BEE7"
                              });
                              setIsViewOnly(false);
                              setIsDialogOpen(true);
                            } else {
                              // For other dates, open the add dialog
                              const dateStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                              setCurrentMeeting({
                                id: "",
                                meeting_type: "",
                                meeting_date: dateStr,
                                meeting_title: "",
                                meeting_description: "",
                                meeting_color: ""
                              });
                              setIsViewOnly(false);
                              setIsDialogOpen(true);
                            }
                          }}
                          style={{
                            backgroundColor: mainBankHoliday ? BANK_HOLIDAY_TYPE.color : 
                                            dateLeaves.length > 0 ? "#f3f4f6" : 
                                            mainMeeting ? mainMeeting.meeting_color : 
                                            !showLeaves && isThursdayDay && dateMeetings.length === 0 ? getMeetingTypeColor("weekly_pulse") : 
                                            isWeekendDay ? "#f4f5f6" : "#ffffff",
                            opacity: isWeekendDay || isPastAndEmpty ? 0.7 : 1
                          }}
                        >
                          <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full text-[10px] sm:text-xs font-medium" style={{
                            color: (mainBankHoliday) || 
                                  (mainMeeting && mainMeeting.meeting_color === "#263238") || 
                                  (!showLeaves && isThursdayDay && dateMeetings.length === 0 && getMeetingTypeColor("weekly_pulse") === "#263238") 
                                  ? "white" : "black",
                             opacity: isPastAndEmpty ? 0.6 : 1,
                          }}>
                            {dayNumber}
                          </div>
                          
                          {/* Show initials for team members on leave */}
                          {showLeaves && dateLeaves.length > 0 && (
                            <div className="absolute -top-1 -right-1 flex flex-col gap-0.5">
                              {dateLeaves.slice(0, 3).map((leave, index) => {
                                const memberColor = teamMemberColors.get(leave.user_id) || LEAVE_TYPE.color;
                                const initials = leave.user_name ? leave.user_name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'U';
                                return (
                                  <div
                                    key={`${leave.user_id}-${index}`}
                                    className="w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center text-white shadow-sm"
                                    style={{ backgroundColor: memberColor }}
                                    title={`${leave.user_name} - ${leave.duration_days} day(s)`}
                                  >
                                    {initials}
                                  </div>
                                );
                              })}
                              {dateLeaves.length > 3 && (
                                <div
                                  className="w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center text-white shadow-sm bg-gray-500"
                                  title={`${dateLeaves.length - 3} more team members on leave`}
                                >
                                  +{dateLeaves.length - 3}
                            </div>
                          )}
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">Meeting Rhythm Planner</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Organise your company's meeting schedule and leave requests for the year.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-gray-600">Meetings</span>
            <Switch
              checked={showLeaves}
              onCheckedChange={setShowLeaves}
              className="data-[state=checked]:bg-blue-600"
            />
            <span className="text-xs sm:text-sm text-gray-600">Holidays</span>
          </div>
          {isAdmin && showLeaves && (
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                onClick={() => setApprovalsDialog(true)}
                variant="outline"
                size="sm"
                className="border-orange-200 text-orange-700 hover:bg-orange-50 text-xs"
              >
                <CheckCircle className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Approvals</span> ({pendingLeaves.length})
              </Button>
              <Button 
                onClick={() => setEntitlementsDialog(true)}
                variant="outline"
                size="sm"
                className="border-blue-200 text-blue-700 hover:bg-blue-50 text-xs"
              >
                <Settings className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Entitlements</span>
              </Button>
              <Button 
                onClick={() => setTeamMembersDialog(true)}
                variant="outline"
                size="sm"
                className="border-green-200 text-green-700 hover:bg-green-50 text-xs"
              >
                <Users className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Team</span> ({teamMembersDetails.length})
                {teamMembersDetails.length > 0 && (
                  <div className="ml-1 sm:ml-2 flex items-center gap-1">
                    <span className="text-xs">•</span>
                    <span className="text-xs">
                      {teamMembersDetails.filter(m => m.remaining_days < 0).length > 0 && (
                        <span className="text-red-600 font-medium">
                          {teamMembersDetails.filter(m => m.remaining_days < 0).length} over limit
                        </span>
                      )}
                      {teamMembersDetails.filter(m => m.remaining_days <= 5 && m.remaining_days >= 0).length > 0 && (
                        <span className="text-orange-600 font-medium">
                          {teamMembersDetails.filter(m => m.remaining_days <= 5 && m.remaining_days >= 0).length} low balance
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </Button>
            </div>
          )}
          <Button 
            onClick={showLeaves ? handleAddLeave : handleAddMeeting} 
            className="bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm"
            size="sm"
          >
            <Plus className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
            {showLeaves ? "Add Holiday" : "Add Meeting"}
          </Button>
        </div>
      </div>
      
      {/* Enhanced Leave Entitlement Summary - Only show when in leave mode */}
      {showLeaves && userLeaveInfo && (
        <Card className={`border-0 ${
          userLeaveInfo.remaining_days < 0 ? 'bg-red-50 border-red-200' : 
          userLeaveInfo.remaining_days <= 5 ? 'bg-orange-50 border-orange-200' : 
          'bg-blue-50 border-blue-200'
        }`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center text-gray-700">
              <Calendar className="mr-2 h-4 w-4 text-blue-500" />
              Your Leave Entitlement ({new Date().getFullYear()})
              {userLeaveInfo.remaining_days < 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  Over Limit
                </Badge>
              )}
              {userLeaveInfo.remaining_days <= 5 && userLeaveInfo.remaining_days >= 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Low Balance
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">{userLeaveInfo.total_entitlement}</div>
                <div className="text-xs text-gray-600">Total Days</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-600">{userLeaveInfo.used_leave_days}</div>
                <div className="text-xs text-gray-600">Used Days</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-600">{userLeaveInfo.bank_holidays}</div>
                <div className="text-xs text-gray-600">Bank Holidays</div>
              </div>
              <div className="text-center">
                <div className={`text-lg font-bold ${
                  userLeaveInfo.remaining_days < 0 ? 'text-red-600' : 
                  userLeaveInfo.remaining_days <= 5 ? 'text-orange-600' : 
                  'text-green-600'
                }`}>
                  {userLeaveInfo.remaining_days < 0 ? Math.abs(userLeaveInfo.remaining_days) : userLeaveInfo.remaining_days}
                </div>
                <div className="text-xs text-gray-600">
                  {userLeaveInfo.remaining_days < 0 ? 'Days Over' : 'Remaining'}
                </div>
              </div>
            </div>
            
            {/* Leave Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Leave Usage</span>
                <span>{Math.round(((userLeaveInfo.total_entitlement - userLeaveInfo.remaining_days) / userLeaveInfo.total_entitlement) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    userLeaveInfo.remaining_days < 0 ? 'bg-red-500' : 
                    userLeaveInfo.remaining_days <= 5 ? 'bg-orange-500' : 
                    'bg-green-500'
                  }`}
                  style={{ 
                    width: `${Math.min(100, Math.max(0, ((userLeaveInfo.total_entitlement - userLeaveInfo.remaining_days) / userLeaveInfo.total_entitlement) * 100))}%` 
                  }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card className="border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center text-gray-700">
            <Info className="mr-2 h-4 w-4 text-blue-500" />
            Legend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 sm:gap-4">
            {!showLeaves && MEETING_TYPES.map((type) => (
              <div 
                key={type.id} 
                className="flex items-center"
              >
                <div 
                  className="w-4 h-4 rounded-sm mr-2" 
                  style={{ backgroundColor: type.color }}
                />
                <span className="text-xs text-gray-700 truncate">{type.name}</span>
              </div>
            ))}
            {showLeaves && (
              <>
              <div className="flex items-center">
                <div 
                  className="w-4 h-4 rounded-sm mr-2" 
                  style={{ backgroundColor: LEAVE_TYPE.color }}
                />
                <span className="text-xs text-gray-700 truncate">{LEAVE_TYPE.name}</span>
              </div>
                {/* Show team member initials if available */}
                {Array.from(teamMemberColors.entries()).map(([userId, color]) => {
                  const leave = leaves.find(l => l.user_id === userId);
                  return leave ? (
                    <div key={userId} className="flex items-center">
                      <div 
                        className="w-6 h-6 rounded-full mr-2 flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: color }}
                        title={leave.user_name}
                      >
                        {leave.user_name ? leave.user_name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'U'}
                      </div>
                      <span className="text-xs text-gray-700 truncate">{leave.user_name}</span>
                    </div>
                  ) : null;
                })}
              </>
            )}
            <div className="flex items-center">
              <div 
                className="w-4 h-4 rounded-sm mr-2" 
                style={{ backgroundColor: BANK_HOLIDAY_TYPE.color }}
              />
              <span className="text-xs text-gray-700 truncate">{BANK_HOLIDAY_TYPE.name}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Calendar Section - Left side (3/4 width) */}
        <div className="lg:col-span-3">
          {isLoading && !isDialogOpen ? (
            <div className="flex justify-center my-12">
              <Spinner className="h-8 w-8 text-blue-600" />
            </div>
          ) : (
            renderCalendar()
          )}
        </div>

        {/* Meetings/Leaves List Section - Right side (1/4 width) */}
        <div className="lg:col-span-1">
          <Card className="border shadow-sm bg-white h-fit">
            <CardHeader className="py-3 bg-blue-50 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center text-gray-800">
                  <div className="bg-blue-100 p-1.5 rounded-lg mr-3">
                    {showLeaves ? <Users className="h-4 w-4 text-blue-600" /> : <Calendar className="h-4 w-4 text-blue-600" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {showLeaves 
                        ? "Holiday Requests" 
                        : (showPastMeetings ? "All Meetings" : "Upcoming Meetings")
                      }
                    </div>
                    <div className="text-xs text-gray-500 font-normal">
                      {showLeaves ? `${leaves.length} total` : `${getFilteredMeetings().length} scheduled`}
                      {showLeaves && leaves.length > 0 && (
                        <div className="text-xs text-gray-500 font-normal mt-1">
                          {leaves.filter(l => l.is_over_limit).length > 0 && (
                            <span className="text-red-500 font-medium">
                              {leaves.filter(l => l.is_over_limit).length} over limit
                            </span>
                          )}
                          {leaves.filter(l => l.current_leave_balance <= 5 && l.current_leave_balance >= 0).length > 0 && (
                            <span className="text-orange-500 font-medium">
                              {leaves.filter(l => l.current_leave_balance <= 5 && l.current_leave_balance >= 0).length} low balance
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardTitle>
                {!showLeaves && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Past</span>
                    <Switch
                      checked={showPastMeetings}
                      onCheckedChange={setShowPastMeetings}
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-auto">
                <div className="p-4">
                  {showLeaves ? (
                    // Show leaves
                    leaves.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <div className="bg-gray-50 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                          <Users className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-600">No holiday requests</p>
                        <p className="text-xs text-gray-400 mt-1">Add your first holiday request to get started</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {leaves
                          .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                          .map((leave) => (
                            <div
                              key={leave.id}
                              className="relative overflow-hidden rounded-xl cursor-pointer transition-all duration-200 border border-gray-200"
                              style={{ 
                                backgroundColor: teamMemberColors.get(leave.user_id) || LEAVE_TYPE.color,
                              }}
                              onClick={() => handleViewLeave(leave)}
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-60"></div>
                              
                              <div className="relative p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0 mr-2">
                                    <div className="flex items-center gap-2 mb-1 justify-between">
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
                                          style={{ backgroundColor: "rgba(255,255,255,0.3)" }}
                                        >
                                          {leave.user_name ? leave.user_name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'U'}
                                        </div>
                                      <h4 className="text-sm font-semibold leading-tight text-white">
                                        {leave.user_name || "Unknown User"}
                                      </h4>
                                      </div>
                                      <Badge 
                                        className="text-xs font-medium px-2 py-1 rounded-md border-0"
                                        style={{
                                          backgroundColor: "rgba(255,255,255,0.2)",
                                          color: "white",
                                          backdropFilter: "blur(4px)"
                                        }}
                                      >
                                        {leave.status}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-1 mb-2">
                                      <div className="w-1 h-1 rounded-full bg-white/70"></div>
                                      <p className="text-xs font-medium text-white/90">
                                        {format(new Date(leave.start_date), "MMM d")} - {format(new Date(leave.end_date), "MMM d, yyyy")}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-white/80">{LEAVE_TYPE.name}</span>
                                      <span className="text-xs text-white/80">•</span>
                                      <span className="text-xs text-white/80">{leave.duration_days} day(s)</span>
                                    </div>
                                    
                                    {/* Status Section */}
                                    <div className="mt-2 p-2 bg-white/10 rounded-lg">
                                      <div className="text-xs text-white/70 font-medium mb-1">Status</div>
                                      <div className="text-xs text-white/80">
                                        {leave.current_leave_balance > 0 ? 
                                          `${leave.current_leave_balance} days left` : 
                                          leave.current_leave_balance === 0 ? 
                                            'Leave completed' : 
                                            'Calculating...'
                                        }
                                      </div>
                                      
                                      {/* Status indicators */}
                                      {leave.current_leave_balance === leave.duration_days && (
                                        <div className="flex items-center gap-1 mt-1">
                                          <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                          <span className="text-xs text-white font-medium">About to take leave</span>
                                        </div>
                                      )}
                                      
                                      {leave.current_leave_balance === 0 && (
                                        <div className="flex items-center gap-1 mt-1">
                                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                          <span className="text-xs text-green-200 font-medium">Completed</span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {leave.description && (
                                      <p className="text-xs leading-relaxed line-clamp-2 text-white/80 mt-2">
                                        {leave.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    )
                  ) : (
                    // Show meetings
                    getFilteredMeetings().length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <div className="bg-gray-50 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                          <Calendar className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-600">
                          {showPastMeetings ? "No meetings scheduled" : "No upcoming meetings"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {showPastMeetings ? "Add your first meeting to get started" : "All your meetings are in the past"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {getFilteredMeetings()
                          .sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())
                          .map((meeting) => {
                            const meetingType = MEETING_TYPES.find(t => t.id === meeting.meeting_type);
                            return (
                              <div
                                key={meeting.id}
                                className="relative overflow-hidden rounded-xl cursor-pointer transition-all duration-200 border border-gray-200"
                                style={{ 
                                  backgroundColor: meeting.meeting_color,
                                }}
                                onClick={() => handleViewMeeting(meeting)}
                              >
                                {/* Subtle gradient overlay */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-60"></div>
                                
                                <div className="relative p-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0 mr-2">
                                      <div className="flex items-center gap-2 mb-1 justify-between">
                                        <h4 className="text-sm font-semibold leading-tight" style={{
                                          color: meeting.meeting_color === "#263238" ? "white" : "#1f2937"
                                        }}>
                                          {meeting.meeting_title || meetingType?.name || meeting.meeting_type}
                                        </h4>
                                        <Badge 
                                          className="text-xs font-medium px-2 py-1 rounded-md border-0"
                                          style={{
                                            backgroundColor: meeting.meeting_color === "#263238" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
                                            color: meeting.meeting_color === "#263238" ? "white" : "#374151",
                                            backdropFilter: "blur(4px)"
                                          }}
                                        >
                                          {meetingType?.name || meeting.meeting_type}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-1 mb-2">
                                        <div className="w-1 h-1 rounded-full" style={{
                                          backgroundColor: meeting.meeting_color === "#263238" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.4)"
                                        }}></div>
                                        <p className="text-xs font-medium" style={{
                                          color: meeting.meeting_color === "#263238" ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.7)"
                                        }}>
                                          {format(new Date(meeting.meeting_date), "MMM d, yyyy")}
                                        </p>
                                      </div>
                                      {meeting.meeting_description && (
                                        <p className="text-xs leading-relaxed line-clamp-2" style={{
                                          color: meeting.meeting_color === "#263238" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.6)"
                                        }}>
                                          {meeting.meeting_description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        }
                      </div>
                    )
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      <MeetingDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveMeeting}
        onSaveLeave={handleSaveLeave}
        onDelete={currentMeeting?.leave_type ? handleDeleteLeave : handleDeleteMeeting}
        onEdit={handleEditMeeting}
        meeting={currentMeeting}
        isLoading={isLoading}
        viewOnly={isViewOnly}
        teamMemberColors={teamMemberColors}
      />

      {leaveSummaryDialog.isOpen && leaveSummaryDialog.date && (
        <LeaveSummaryDialog
          isOpen={leaveSummaryDialog.isOpen}
          onClose={() => setLeaveSummaryDialog({ isOpen: false, date: "", leaves: [] })}
          date={leaveSummaryDialog.date}
          leaves={leaveSummaryDialog.leaves}
          teamMemberColors={teamMemberColors}
          onViewLeave={(leave) => {
            setLeaveSummaryDialog({ isOpen: false, date: "", leaves: [] });
            handleViewLeave(leave);
          }}
        />
      )}

            {/* Approvals Dialog */}
      <Dialog open={approvalsDialog} onOpenChange={setApprovalsDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Leave Approvals ({pendingLeaves.length})
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
            {pendingLeaves.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
                <p className="text-gray-500">No pending leave requests to review.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingLeaves.map((leave) => (
                  <Card key={leave.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">{leave.user_name}</h3>
                        <p className="text-sm text-gray-500">
                          {format(new Date(leave.start_date), "MMM d")} - {format(new Date(leave.end_date), "MMM d, yyyy")} 
                          ({leave.duration_days} day{leave.duration_days !== 1 ? 's' : ''})
                        </p>
                        {leave.description && (
                          <p className="text-sm text-gray-600 mt-1">{leave.description}</p>
                        )}
                      </div>
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedLeaveForApproval(leave);
                          setApprovalAction('approve');
                          setApprovalComments('');
                        }}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedLeaveForApproval(leave);
                          setApprovalAction('reject');
                          setApprovalComments('');
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Entitlements Dialog */}
      <Dialog open={entitlementsDialog} onOpenChange={setEntitlementsDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Leave Entitlements
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add/Edit Entitlement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="entitlement-year">Year</Label>
                    <Input
                      id="entitlement-year"
                      type="number"
                      value={entitlementForm.year}
                      onChange={(e) => setEntitlementForm({ ...entitlementForm, year: parseInt(e.target.value) })}
                      min={new Date().getFullYear() - 5}
                      max={new Date().getFullYear() + 5}
                    />
                  </div>
                  <div>
                    <Label htmlFor="entitlement-days">Total Days</Label>
                    <Input
                      id="entitlement-days"
                      type="number"
                      value={entitlementForm.total_entitlement_days}
                      onChange={(e) => setEntitlementForm({ ...entitlementForm, total_entitlement_days: parseInt(e.target.value) })}
                      min="1"
                      max="365"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveEntitlement} disabled={isLoading} className="w-full">
                  Save Entitlement
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Entitlements</CardTitle>
              </CardHeader>
              <CardContent>
                {entitlements.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500">No entitlements configured yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {entitlements.map((entitlement) => (
                      <div key={entitlement.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <h3 className="font-medium">{entitlement.year}</h3>
                          <p className="text-sm text-gray-500">{entitlement.total_entitlement_days} days</p>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteEntitlement(entitlement.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Team Members Dialog */}
      <Dialog open={teamMembersDialog} onOpenChange={setTeamMembersDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members ({teamMembersDetails.length})
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
            {teamMembersDetails.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Team Members</h3>
                <p className="text-gray-500">No team members found.</p>
              </div>
            ) : (
              <>
                {/* Team Leave Summary */}
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {teamMembersDetails.reduce((sum, member) => sum + Math.max(0, member.remaining_days), 0)}
                        </div>
                        <div className="text-sm text-blue-700">Total Days Available</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {teamMembersDetails.reduce((sum, member) => sum + member.total_days_taken, 0)}
                        </div>
                        <div className="text-sm text-green-700">Total Days Taken</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {teamMembersDetails.reduce((sum, member) => sum + member.total_days_pending, 0)}
                        </div>
                        <div className="text-sm text-orange-700">Total Days Pending</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {teamMembersDetails.filter(member => member.remaining_days < 0).length}
                        </div>
                        <div className="text-sm text-red-700">Members Over Limit</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <div className="space-y-4">
                  {teamMembersDetails.map((member) => (
                  <Card key={member.user_id} className="p-4">
                    {/* Enhanced Leave Balance Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm"
                          style={{ backgroundColor: teamMemberColors.get(member.user_id) || TEAM_MEMBER_COLORS[0] }}
                        >
                          {member.full_name ? member.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'U'}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{member.full_name}</h3>
                          <p className="text-sm text-gray-500">{member.email}</p>
                        </div>
                      </div>
                      
                      {/* Enhanced Leave Balance Display */}
                      <div className="text-right">
                        <div className="flex items-center gap-2 mb-1">
                          {member.remaining_days < 0 ? (
                            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                          ) : member.remaining_days <= 5 ? (
                            <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse"></div>
                          ) : (
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          )}
                          <div className={`text-lg font-bold ${
                            member.remaining_days < 0 ? 'text-red-600' : 
                            member.remaining_days <= 5 ? 'text-orange-600' : 
                            'text-green-600'
                          }`}>
                            {member.remaining_days < 0 ? Math.abs(member.remaining_days) : member.remaining_days}
                          </div>
                          <div className={`text-sm font-medium ${
                            member.remaining_days < 0 ? 'text-red-600' : 
                            member.remaining_days <= 5 ? 'text-orange-600' : 
                            'text-gray-900'
                          }`}>
                            {member.remaining_days < 0 ? 'days over' : 'days left'}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          of {member.total_entitlement} total
                        </div>
                        
                        {/* Leave Balance Status Badge */}
                        <div className="mt-2">
                          <Badge 
                            variant={
                              member.remaining_days < 0 ? 'destructive' : 
                              member.remaining_days <= 5 ? 'secondary' : 
                              'default'
                            }
                            className="text-xs"
                          >
                            {member.remaining_days < 0 ? 'Over Limit' : 
                             member.remaining_days <= 5 ? 'Low Balance' : 
                             'Good Balance'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Leave Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Leave Usage</span>
                        <span>{Math.round(((member.total_entitlement - member.remaining_days) / member.total_entitlement) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            member.remaining_days < 0 ? 'bg-red-500' : 
                            member.remaining_days <= 5 ? 'bg-orange-500' : 
                            'bg-green-500'
                          }`}
                          style={{ 
                            width: `${Math.min(100, Math.max(0, ((member.total_entitlement - member.remaining_days) / member.total_entitlement) * 100))}%` 
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Enhanced Leave Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="text-lg font-bold text-green-600">{member.total_days_taken}</div>
                        <div className="text-xs text-green-700">Days Taken</div>
                        <div className="text-xs text-green-600 mt-1">
                          {Math.round((member.total_days_taken / member.total_entitlement) * 100)}%
                        </div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="text-lg font-bold text-orange-600">{member.total_days_pending}</div>
                        <div className="text-xs text-orange-700">Days Pending</div>
                        <div className="text-xs text-orange-600 mt-1">
                          {Math.round((member.total_days_pending / member.total_entitlement) * 100)}%
                        </div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-lg font-bold text-blue-600">{member.bank_holidays}</div>
                        <div className="text-xs text-blue-700">Bank Holidays</div>
                        <div className="text-xs text-blue-600 mt-1">
                          {Math.round((member.bank_holidays / member.total_entitlement) * 100)}%
                        </div>
                      </div>
                      <div className={`text-center p-3 rounded-lg border ${
                        member.remaining_days < 0 ? 'bg-red-50 border-red-200' : 
                        member.remaining_days <= 5 ? 'bg-orange-50 border-orange-200' : 
                        'bg-gray-50 border-gray-200'
                      }`}>
                        <div className={`text-lg font-bold ${
                          member.remaining_days < 0 ? 'text-red-600' : 
                          member.remaining_days <= 5 ? 'text-orange-600' : 
                          'text-gray-600'
                        }`}>
                          {member.remaining_days < 0 ? Math.abs(member.remaining_days) : member.remaining_days}
                        </div>
                        <div className={`text-xs ${
                          member.remaining_days < 0 ? 'text-red-700' : 
                          member.remaining_days <= 5 ? 'text-orange-700' : 
                          'text-gray-700'
                        }`}>
                          {member.remaining_days < 0 ? 'Days Over' : 'Remaining'}
                        </div>
                        <div className={`text-xs mt-1 ${
                          member.remaining_days < 0 ? 'text-red-600' : 
                          member.remaining_days <= 5 ? 'text-orange-600' : 
                          'text-gray-600'
                        }`}>
                          {Math.round((Math.max(0, member.remaining_days) / member.total_entitlement) * 100)}%
                        </div>
                      </div>
                    </div>

                    {/* Leave Request Counts */}
                    <div className="flex items-center justify-between text-sm mb-3">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-gray-600">{member.approved_leaves} Approved</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                          <span className="text-gray-600">{member.pending_leaves} Pending</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span className="text-gray-600">{member.rejected_leaves} Rejected</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {member.all_leaves.length} total requests
                      </div>
                    </div>

                    {/* Recent Leaves */}
                    {member.all_leaves.length > 0 && (
                      <div className="border-t pt-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Leave Requests</h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {member.all_leaves
                            .sort((a: any, b: any) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
                            .slice(0, 3)
                            .map((leave: any) => (
                              <div key={leave.id} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                                <div>
                                  <span className="font-medium">
                                    {format(new Date(leave.start_date), "MMM d")} - {format(new Date(leave.end_date), "MMM d")}
                                  </span>
                                  <span className="text-gray-500 ml-2">({leave.duration_days} days)</span>
                                </div>
                                <Badge 
                                  className="text-xs"
                                  variant={
                                    leave.status === 'approved' ? 'default' : 
                                    leave.status === 'pending' ? 'secondary' : 'destructive'
                                  }
                                >
                                  {leave.status}
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={!!selectedLeaveForApproval} onOpenChange={(open) => !open && setSelectedLeaveForApproval(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Approve' : 'Reject'} Leave Request
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedLeaveForApproval && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Employee</Label>
                  <p className="text-sm text-gray-600">{selectedLeaveForApproval.user_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Leave Period</Label>
                  <p className="text-sm text-gray-600">
                    {format(new Date(selectedLeaveForApproval.start_date), "MMM d, yyyy")} - {format(new Date(selectedLeaveForApproval.end_date), "MMM d, yyyy")} 
                    ({selectedLeaveForApproval.duration_days} day{selectedLeaveForApproval.duration_days !== 1 ? 's' : ''})
                  </p>
                </div>
                {selectedLeaveForApproval.description && (
                  <div>
                    <Label className="text-sm font-medium">Reason</Label>
                    <p className="text-sm text-gray-600">{selectedLeaveForApproval.description}</p>
                  </div>
                )}
                <div>
                  <Label htmlFor="approval-comments" className="text-sm font-medium">
                    Comments (Optional)
                  </Label>
                  <Textarea
                    id="approval-comments"
                    value={approvalComments}
                    onChange={(e) => setApprovalComments(e.target.value)}
                    placeholder={`Add a comment for this ${approvalAction === 'approve' ? 'approval' : 'rejection'}...`}
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLeaveForApproval(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleApproval} 
              disabled={isLoading}
              variant={approvalAction === 'approve' ? 'default' : 'destructive'}
            >
              {approvalAction === 'approve' ? 'Approve' : 'Reject'} Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
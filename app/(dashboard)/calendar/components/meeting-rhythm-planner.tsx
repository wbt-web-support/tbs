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
import { Calendar, Info, Plus, Trash2, Eye, Edit, ChevronRight, ChevronLeft, SquareCode, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

const MeetingDialog = ({ isOpen, onClose, onSave, onSaveLeave, onDelete, onEdit, meeting, isLoading, viewOnly = false }: MeetingDialogProps) => {
  const [formData, setFormData] = useState<Partial<Meeting>>({
    meeting_type: "",
    meeting_date: format(new Date(), "yyyy-MM-dd"),
    meeting_title: "",
    meeting_description: "",
    meeting_color: "",
  });

  const isLeave = meeting?.leave_type || formData.leave_type;

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
  };

  const handleSubmit = () => {
    if (isLeave && onSaveLeave) {
      // For leaves, we need to call the leave save function
      const leaveData = {
        id: formData.id,
        leave_type: formData.leave_type || "leave", // Ensure leave_type is always set
        start_date: formData.start_date,
        end_date: formData.end_date,
        status: formData.status || "pending",
        duration_days: formData.duration_days || 1,
        description: formData.description || "",
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
                backgroundColor: LEAVE_TYPE.color,
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
            <Button onClick={handleSubmit} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : null}
              {meeting ? "Update" : "Save"}
            </Button>
          </div>
        </DialogFooter>
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
  const { toast } = useToast();
  const supabase = createClient();

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
      
      // Map user names to leaves
      const leavesWithNames = data?.map((leave: any) => {
        const teamMember = teamMembers.find((member: any) => member.user_id === leave.user_id);
        return {
          ...leave,
          user_name: teamMember?.full_name || 'Unknown User'
        };
      }) || [];
      
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
    fetchMeetings();
    if (showLeaves) {
      fetchLeaves();
    }
  }, [selectedYear, showLeaves]);

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
            user_id: user.id,
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

  const handleAddLeave = () => {
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
        
        <CardContent className="p-4 pt-4">
          <ScrollArea className="h-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 p-2">
              {months.map((month, monthIndex) => (
                <Card key={month} className="border overflow-hidden rounded-xl bg-gray-50">
                  <CardHeader className="py-2 px-3 border-b ">
                    <h3 className="text-sm font-semibold text-gray-700 tracking-wide">{month}</h3>
                  </CardHeader>
                  <div className="grid grid-cols-7 text-center text-[10px]">
                    {daysOfWeek.map((day, i) => (
                      <div key={i} className="p-1 border-b font-semibold text-gray-500">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 p-1 text-xs">
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
                        <div key={`empty-${index}`} className="aspect-square p-1"></div>
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
                      // If there's a leave, use its color
                      else if (mainLeave) {
                        bgColor = `bg-[${LEAVE_TYPE.color}]`;
                      }
                      // If there's a meeting, use its color (only in meeting mode)
                      else if (mainMeeting) {
                        bgColor = `bg-[${mainMeeting.meeting_color}]`;
                      }
                      
                      return (
                        <div
                          key={day}
                          className={`aspect-square p-1 relative transition-all rounded-md transform ${!isPastAndEmpty ? 'cursor-pointer hover:opacity-90 hover:scale-105 hover:z-10 border-2 border-transparent hover:border-gray-200' : 'cursor-not-allowed'}`}
                          onClick={() => {
                            // Allow viewing leaves on any date
                            if (showLeaves && dateLeaves.length > 0) {
                              handleViewLeave(dateLeaves[0]);
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
                                description: ""
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
                                            mainLeave ? LEAVE_TYPE.color : 
                                            mainMeeting ? mainMeeting.meeting_color : 
                                            !showLeaves && isThursdayDay && dateMeetings.length === 0 ? getMeetingTypeColor("weekly_pulse") : 
                                            isWeekendDay ? "#f4f5f6" : "#ffffff",
                            opacity: isWeekendDay || isPastAndEmpty ? 0.7 : 1
                          }}
                        >
                          <div className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium" style={{
                            color: (mainBankHoliday) || 
                                  (mainLeave) || 
                                  (mainMeeting && mainMeeting.meeting_color === "#263238") || 
                                  (!showLeaves && isThursdayDay && dateMeetings.length === 0 && getMeetingTypeColor("weekly_pulse") === "#263238") 
                                  ? "white" : "black",
                             opacity: isPastAndEmpty ? 0.6 : 1,
                          }}>
                            {dayNumber}
                          </div>
                          {dateLeaves.length > 1 && (
                            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                              {dateLeaves.length}
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
    <div className="space-y-6 py-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Meeting Rhythm Planner</h1>
          <p className="text-sm text-gray-500 mt-1">
            Organise your company's meeting schedule and leave requests for the year.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Meetings</span>
            <Switch
              checked={showLeaves}
              onCheckedChange={setShowLeaves}
              className="data-[state=checked]:bg-blue-600"
            />
            <span className="text-sm text-gray-600">Leaves</span>
          </div>
          <Button 
            onClick={showLeaves ? handleAddLeave : handleAddMeeting} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            {showLeaves ? "Add Leave" : "Add Meeting"}
          </Button>
        </div>
      </div>
      
      <Card className="border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center text-gray-700">
            <Info className="mr-2 h-4 w-4 text-blue-500" />
            Legend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {!showLeaves && MEETING_TYPES.map((type) => (
              <div 
                key={type.id} 
                className="flex items-center"
              >
                <div 
                  className="w-4 h-4 rounded-sm mr-2" 
                  style={{ backgroundColor: type.color }}
                />
                <span className="text-xs text-gray-700">{type.name}</span>
              </div>
            ))}
            {showLeaves && (
              <div className="flex items-center">
                <div 
                  className="w-4 h-4 rounded-sm mr-2" 
                  style={{ backgroundColor: LEAVE_TYPE.color }}
                />
                <span className="text-xs text-gray-700">{LEAVE_TYPE.name}</span>
              </div>
            )}
            <div className="flex items-center">
              <div 
                className="w-4 h-4 rounded-sm mr-2" 
                style={{ backgroundColor: BANK_HOLIDAY_TYPE.color }}
              />
              <span className="text-xs text-gray-700">{BANK_HOLIDAY_TYPE.name}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
                        ? "Leave Requests" 
                        : (showPastMeetings ? "All Meetings" : "Upcoming Meetings")
                      }
                    </div>
                    <div className="text-xs text-gray-500 font-normal">
                      {showLeaves ? `${leaves.length} total` : `${getFilteredMeetings().length} scheduled`}
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
                        <p className="text-sm font-medium text-gray-600">No leave requests</p>
                        <p className="text-xs text-gray-400 mt-1">Add your first leave request to get started</p>
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
                                backgroundColor: LEAVE_TYPE.color,
                              }}
                              onClick={() => handleViewLeave(leave)}
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-60"></div>
                              
                              <div className="relative p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0 mr-2">
                                    <div className="flex items-center gap-2 mb-1 justify-between">
                                      <h4 className="text-sm font-semibold leading-tight text-white">
                                        {leave.user_name || "Unknown User"}
                                      </h4>
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
      />
    </div>
  );
} 
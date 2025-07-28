"use client";

import { useState, useEffect } from "react";
import { format, parseISO, getYear, getMonth, getDaysInMonth, getDay, addDays, isSameDay } from "date-fns";
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
import { Calendar, Info, Plus, Trash2, Eye, Edit, ChevronRight, ChevronLeft, Users, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";


type Leave = {
  id: string;
  user_id?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  duration_days: number;
  description?: string;
  user_name?: string;
};

type BankHoliday = {
  id: string;
  holiday_name: string;
  holiday_date: string;
  is_active: boolean;
};

type LeaveSummary = {
  total_entitlement: number;
  bank_holidays: number;
  personal_leave_balance: number;
  used_leave: number;
  remaining_leave: number;
};

const LEAVE_TYPES = [
  { id: "annual_leave", name: "Annual Leave", color: "#4CAF50" },
  { id: "sick_leave", name: "Sick Leave", color: "#FF9800" },
  { id: "personal_leave", name: "Personal Leave", color: "#2196F3" },
  { id: "maternity_leave", name: "Maternity Leave", color: "#E91E63" },
  { id: "paternity_leave", name: "Paternity Leave", color: "#9C27B0" },
  { id: "bereavement_leave", name: "Bereavement Leave", color: "#607D8B" },
];

const LEAVE_STATUSES = [
  { id: "pending", name: "Pending", color: "#FF9800" },
  { id: "approved", name: "Approved", color: "#4CAF50" },
  { id: "rejected", name: "Rejected", color: "#F44336" },
  { id: "cancelled", name: "Cancelled", color: "#9E9E9E" },
];

// Default UK Bank Holidays for 2025
const DEFAULT_BANK_HOLIDAYS_2025 = [
  { holiday_name: "New Year's Day", holiday_date: "2025-01-01" },
  { holiday_name: "Good Friday", holiday_date: "2025-04-18" },
  { holiday_name: "Easter Monday", holiday_date: "2025-04-21" },
  { holiday_name: "Early May Bank Holiday", holiday_date: "2025-05-05" },
  { holiday_name: "Spring Bank Holiday", holiday_date: "2025-05-26" },
  { holiday_name: "Summer Bank Holiday", holiday_date: "2025-08-25" },
  { holiday_name: "Christmas Day", holiday_date: "2025-12-25" },
  { holiday_name: "Boxing Day", holiday_date: "2025-12-26" },
];

type LeaveDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (leave: Partial<Leave>) => void;
  onDelete?: (id: string) => void;
  onEdit?: () => void;
  leave?: Leave;
  isLoading: boolean;
  viewOnly?: boolean;
};

const LeaveDialog = ({ isOpen, onClose, onSave, onDelete, onEdit, leave, isLoading, viewOnly = false }: LeaveDialogProps) => {
  const [formData, setFormData] = useState<Partial<Leave>>({
    leave_type: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(new Date(), "yyyy-MM-dd"),
    status: "pending",
    duration_days: 1,
    description: "",
  });

  useEffect(() => {
    if (leave) {
      setFormData({
        id: leave.id,
        leave_type: leave.leave_type,
        start_date: leave.start_date,
        end_date: leave.end_date,
        status: leave.status,
        duration_days: leave.duration_days,
        description: leave.description || "",
      });
    } else {
      setFormData({
        leave_type: "",
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: format(new Date(), "yyyy-MM-dd"),
        status: "pending",
        duration_days: 1,
        description: "",
      });
    }
  }, [leave, isOpen]);

  const handleChange = (name: string, value: string | number) => {
    setFormData({ ...formData, [name]: value });

    // Calculate duration when dates change
    if (name === "start_date" || name === "end_date") {
      const startDate = name === "start_date" ? value : formData.start_date;
      const endDate = name === "end_date" ? value : formData.end_date;
      
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setFormData(prev => ({ ...prev, [name]: value, duration_days: diffDays }));
      }
    }
  };

  const handleSubmit = () => {
    onSave(formData);
  };

  const getLeaveTypeName = (typeId: string) => {
    const leaveType = LEAVE_TYPES.find(type => type.id === typeId);
    return leaveType?.name || typeId;
  };

  const getLeaveTypeColor = (typeId: string) => {
    const leaveType = LEAVE_TYPES.find(type => type.id === typeId);
    return leaveType?.color || "#e0e0e0";
  };

  const getStatusName = (statusId: string) => {
    const status = LEAVE_STATUSES.find(s => s.id === statusId);
    return status?.name || statusId;
  };

  const getStatusColor = (statusId: string) => {
    const status = LEAVE_STATUSES.find(s => s.id === statusId);
    return status?.color || "#e0e0e0";
  };

  if (viewOnly && leave) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[450px] rounded-xl p-0 overflow-hidden border-none shadow-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>{leave.user_name || "Leave Request"}</DialogTitle>
          </DialogHeader>
          <div 
            className="py-5 px-6" 
            style={{
              backgroundColor: getLeaveTypeColor(leave.leave_type),
              color: "white"
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{leave.user_name || "Leave Request"}</h2>
                <p className="text-sm opacity-80 mt-1">
                  {format(new Date(leave.start_date), "MMM d")} - {format(new Date(leave.end_date), "MMM d, yyyy")}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge 
                  className="text-xs font-medium py-1 px-2"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.25)",
                    backdropFilter: "blur(4px)",
                    color: "white"
                  }}
                >
                  {getLeaveTypeName(leave.leave_type)}
                </Badge>
                <Badge 
                  className="text-xs font-medium py-1 px-2"
                  style={{
                    backgroundColor: getStatusColor(leave.status),
                    color: "white"
                  }}
                >
                  {getStatusName(leave.status)}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Duration</h3>
                <p className="text-sm text-gray-800">{leave.duration_days} day(s)</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
                <p className="text-sm text-gray-800">{getStatusName(leave.status)}</p>
              </div>
            </div>
            {leave.description && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
                <p className="text-sm text-gray-800">{leave.description}</p>
              </div>
            )}
          </div>
          
          <div className="py-3 px-6 flex justify-between items-center border-t border-gray-100">
            {onDelete && (
              <Button 
                variant="ghost" 
                onClick={() => onDelete(leave.id)}
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
          <DialogTitle>{leave ? "Edit Leave Request" : "Add Leave Request"}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4 space-y-5">
          <div className="space-y-1">
            <Label htmlFor="leave_type" className="text-sm font-medium">
              Leave Type
            </Label>
            <CustomDropdown
              value={formData.leave_type || ""}
              onChange={(value) => handleChange("leave_type", value)}
              placeholder="Select leave type"
              options={LEAVE_TYPES.map(type => ({ 
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
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="start_date" className="text-sm font-medium">
                Start Date
              </Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
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
                value={formData.end_date}
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
              value={formData.duration_days}
              onChange={(e) => handleChange("duration_days", parseInt(e.target.value))}
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
        </div>
        
        <DialogFooter className="px-6 py-4 bg-gray-50 flex items-center justify-between">
          {leave && onDelete && (
            <Button 
              variant="ghost" 
              onClick={() => onDelete(leave.id)}
              disabled={isLoading}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          )}
          <div className={`flex gap-2 ${leave && onDelete ? "" : "ml-auto"}`}>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : null}
              {leave ? "Update" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function TeamLeavesPlanner() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [bankHolidays, setBankHolidays] = useState<BankHoliday[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isBankHolidayDialogOpen, setIsBankHolidayDialogOpen] = useState<boolean>(false);
  const [isViewOnly, setIsViewOnly] = useState<boolean>(false);
  const [currentLeave, setCurrentLeave] = useState<Leave | undefined>(undefined);
  const [leaveSummary, setLeaveSummary] = useState<LeaveSummary>({
    total_entitlement: 28,
    bank_holidays: 8,
    personal_leave_balance: 20,
    used_leave: 0,
    remaining_leave: 20,
  });
  const { toast } = useToast();
  const supabase = createClient();

  const fetchLeaves = async () => {
    setIsLoading(true);
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
      
      // Calculate leave summary
      const usedLeave = leavesWithNames.reduce((total: number, leave: any) => {
        if (leave.status === 'approved') {
          return total + leave.duration_days;
        }
        return total;
      }, 0);
      
      setLeaveSummary(prev => ({
        ...prev,
        used_leave: usedLeave,
        remaining_leave: prev.personal_leave_balance - usedLeave
      }));
    } catch (error: any) {
      console.error("Error fetching leaves:", error);
      toast({
        title: "Error fetching leaves",
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
        .order('holiday_date', { ascending: true });

      if (error) throw error;
      setBankHolidays(data || []);
    } catch (error: any) {
      console.error("Error fetching bank holidays:", error);
    }
  };

  useEffect(() => {
    fetchLeaves();
    fetchBankHolidays();
  }, [selectedYear]);

  const handleSaveLeave = async (leave: Partial<Leave>) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No authenticated user");
      
      if (leave.id) {
        // Update existing leave
        const { error } = await supabase
          .from('team_leaves')
          .update({
            leave_type: leave.leave_type,
            start_date: leave.start_date,
            end_date: leave.end_date,
            status: leave.status,
            duration_days: leave.duration_days,
            description: leave.description,
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
            leave_type: leave.leave_type,
            start_date: leave.start_date,
            end_date: leave.end_date,
            status: leave.status,
            duration_days: leave.duration_days,
            description: leave.description,
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
    setCurrentLeave(undefined);
    setIsViewOnly(false);
    setIsDialogOpen(true);
  };

  const handleViewLeave = (leave: Leave) => {
    setCurrentLeave(leave);
    setIsViewOnly(true);
    setIsDialogOpen(true);
  };

  const handleEditLeave = () => {
    setIsViewOnly(false);
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

  const getLeaveTypeColor = (type: string) => {
    const leaveType = LEAVE_TYPES.find(t => t.id === type);
    return leaveType?.color || "#e0e0e0";
  };

  const renderCalendar = () => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const daysOfWeek = ["M", "T", "W", "T", "F", "S", "S"];

    return (
      <Card className="border-0 overflow-hidden bg-white">
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
                  <CardHeader className="py-2 px-3 border-b">
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
                      const firstDayOfMonth = new Date(selectedYear, monthIndex, 1);
                      let dayOffset = getDay(firstDayOfMonth);
                      dayOffset = dayOffset === 0 ? 6 : dayOffset - 1;
                      
                      return Array.from({ length: dayOffset }).map((_, index) => (
                        <div key={`empty-${index}`} className="aspect-square p-1"></div>
                      ));
                    })()}
                    
                    {Array.from({ length: getDaysInMonth(new Date(selectedYear, monthIndex)) }).map((_, day) => {
                      const dayNumber = day + 1;
                      const dateLeaves = getLeavesForDate(selectedYear, monthIndex, dayNumber);
                      const dateBankHolidays = getBankHolidaysForDate(selectedYear, monthIndex, dayNumber);
                      
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const currentDate = new Date(selectedYear, monthIndex, dayNumber);
                      currentDate.setHours(0, 0, 0, 0);
                      const isPast = currentDate < today;

                      let bgColor = "bg-white";
                      let mainLeave = dateLeaves[0];
                      let mainBankHoliday = dateBankHolidays[0];
                      
                      if (mainLeave) {
                        bgColor = `bg-[${getLeaveTypeColor(mainLeave.leave_type)}]`;
                      } else if (mainBankHoliday) {
                        bgColor = "bg-gray-400";
                      }
                      
                      return (
                        <div
                          key={day}
                          className={`aspect-square p-1 relative transition-all rounded-md transform ${!isPast ? 'cursor-pointer hover:opacity-90 hover:scale-105 hover:z-10 border-2 border-transparent hover:border-gray-200' : 'cursor-not-allowed'}`}
                          onClick={() => {
                            if (dateLeaves.length > 0) {
                              handleViewLeave(dateLeaves[0]);
                              return;
                            }

                            if (isPast) {
                              return;
                            }
                            
                            const dateStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                            setCurrentLeave({
                              id: "",
                              leave_type: "",
                              start_date: dateStr,
                              end_date: dateStr,
                              status: "pending",
                              duration_days: 1,
                              description: ""
                            });
                            setIsViewOnly(false);
                            setIsDialogOpen(true);
                          }}
                          style={{
                            backgroundColor: mainLeave ? getLeaveTypeColor(mainLeave.leave_type) : 
                                            mainBankHoliday ? "#9CA3AF" : "#ffffff",
                            opacity: isPast ? 0.7 : 1
                          }}
                        >
                          <div className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium" style={{
                            color: mainLeave || mainBankHoliday ? "white" : "black",
                            opacity: isPast ? 0.6 : 1,
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
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Team Leaves Planner</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage team leave requests and track leave balances.
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsBankHolidayDialogOpen(true)} 
            variant="outline"
            className="border-gray-300"
          >
            <Calendar className="mr-2 h-4 w-4" />
            Bank Holidays
          </Button>
          <Button onClick={handleAddLeave} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Leave Request
          </Button>
        </div>
      </div>
      
      {/* Leave Summary Section */}
      <Card className="border-0 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center text-gray-800">
            <Users className="mr-2 h-5 w-5 text-blue-600" />
            Leave Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Total Entitlement</span>
                <span className="text-lg font-bold text-gray-900">{leaveSummary.total_entitlement} days</span>
              </div>
              <div className="text-xs text-gray-500">Including bank holidays</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Bank Holidays</span>
                <span className="text-lg font-bold text-gray-900">{leaveSummary.bank_holidays} days</span>
              </div>
              <div className="text-xs text-gray-500">Public holidays</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Used Leave</span>
                <span className="text-lg font-bold text-red-600">{leaveSummary.used_leave} days</span>
              </div>
              <Progress value={(leaveSummary.used_leave / leaveSummary.personal_leave_balance) * 100} className="h-2" />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Remaining</span>
                <span className="text-lg font-bold text-green-600">{leaveSummary.remaining_leave} days</span>
              </div>
              <div className="text-xs text-gray-500">Available for use</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center text-gray-700">
            <Info className="mr-2 h-4 w-4 text-blue-500" />
            Legend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {LEAVE_TYPES.map((type) => (
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
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-sm mr-2 bg-gray-400" />
              <span className="text-xs text-gray-700">Bank Holiday</span>
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

        {/* Leaves List Section - Right side (1/4 width) */}
        <div className="lg:col-span-1">
          <Card className="border shadow-sm bg-white h-fit">
            <CardHeader className="py-3 bg-blue-50 border-b">
              <CardTitle className="text-base font-semibold flex items-center text-gray-800">
                <div className="bg-blue-100 p-1.5 rounded-lg mr-3">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-medium">Leave Requests</div>
                  <div className="text-xs text-gray-500 font-normal">
                    {leaves.length} total
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-auto">
                <div className="p-4">
                  {leaves.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <div className="bg-gray-50 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Clock className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-600">No leave requests</p>
                      <p className="text-xs text-gray-400 mt-1">Add your first leave request to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leaves
                        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                        .map((leave) => {
                          const leaveType = LEAVE_TYPES.find(t => t.id === leave.leave_type);
                          const status = LEAVE_STATUSES.find(s => s.id === leave.status);
                          return (
                            <div
                              key={leave.id}
                              className="relative overflow-hidden rounded-xl cursor-pointer transition-all duration-200 border border-gray-200"
                              style={{ 
                                backgroundColor: leaveType?.color || "#e0e0e0",
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
                                          backgroundColor: status?.color || "#9CA3AF",
                                          color: "white"
                                        }}
                                      >
                                        {status?.name || leave.status}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-1 mb-2">
                                      <div className="w-1 h-1 rounded-full bg-white/70"></div>
                                      <p className="text-xs font-medium text-white/90">
                                        {format(new Date(leave.start_date), "MMM d")} - {format(new Date(leave.end_date), "MMM d, yyyy")}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-white/80">{leaveType?.name || leave.leave_type}</span>
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
                          );
                        })
                      }
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      <LeaveDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveLeave}
        onDelete={handleDeleteLeave}
        onEdit={handleEditLeave}
        leave={currentLeave}
        isLoading={isLoading}
        viewOnly={isViewOnly}
      />
    </div>
  );
} 
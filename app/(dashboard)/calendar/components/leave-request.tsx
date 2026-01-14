"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, Clock, AlertCircle } from "lucide-react";
import { format, parseISO, eachDayOfInterval, isWeekend, isSameDay } from "date-fns";

type LeaveRequest = {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  duration_days: number;
  description: string;
  created_at: string;
};

type LeaveRequestProps = {
  onLeaveRequested?: () => void;
};

const LEAVE_TYPES = [
  "Annual Leave",
  "Sick Leave",
  "Personal Leave",
  "Bereavement Leave",
  "Maternity/Paternity Leave",
  "Other",
];

export default function LeaveRequest({ onLeaveRequested }: LeaveRequestProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    leave_type: "Annual Leave",
    start_date: "",
    end_date: "",
    description: "",
  });
  const [remainingDays, setRemainingDays] = useState<{
    total_entitlement: number;
    used_leave_days: number;
    bank_holidays: number;
    remaining_days: number;
  } | null>(null);
  const [calculatedDuration, setCalculatedDuration] = useState<number>(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [userLeaveRequests, setUserLeaveRequests] = useState<LeaveRequest[]>([]);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    if (isDialogOpen) {
      fetchRemainingDays();
      fetchUserLeaveRequests();
    }
  }, [isDialogOpen]);

  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      calculateDuration();
      validateRequest();
    }
  }, [formData.start_date, formData.end_date, formData.leave_type]);

  const fetchRemainingDays = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase.rpc("calculate_remaining_leave_days", {
        p_user_id: user.id,
        p_year: currentYear,
      });

      if (error) throw error;
      if (data && data.length > 0) {
        setRemainingDays(data[0]);
      }
    } catch (error: any) {
      console.error("Error fetching remaining days:", error);
    }
  };

  const fetchUserLeaveRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("team_leaves")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUserLeaveRequests(data || []);
    } catch (error: any) {
      console.error("Error fetching leave requests:", error);
    }
  };

  const fetchBankHolidays = async (): Promise<string[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: userInfo } = await supabase
        .from("business_info")
        .select("team_id")
        .eq("user_id", user.id)
        .single();

      if (!userInfo?.team_id) return [];

      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from("bank_holidays")
        .select("holiday_date")
        .eq("team_id", userInfo.team_id)
        .eq("year", currentYear)
        .eq("is_active", true);

      if (error) throw error;
      return (data || []).map((h: { holiday_date: any; }) => h.holiday_date);
    } catch (error) {
      console.error("Error fetching bank holidays:", error);
      return [];
    }
  };

  const calculateDuration = async () => {
    if (!formData.start_date || !formData.end_date) {
      setCalculatedDuration(0);
      return;
    }

    try {
      const start = parseISO(formData.start_date);
      const end = parseISO(formData.end_date);

      if (start > end) {
        setCalculatedDuration(0);
        return;
      }

      const bankHolidays = await fetchBankHolidays();
      const days = eachDayOfInterval({ start, end });
      const workingDays = days.filter((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        return !isWeekend(day) && !bankHolidays.includes(dayStr);
      });

      setCalculatedDuration(workingDays.length);
    } catch (error) {
      console.error("Error calculating duration:", error);
      setCalculatedDuration(0);
    }
  };

  const validateRequest = async () => {
    const errors: string[] = [];

    if (!formData.start_date || !formData.end_date) {
      return;
    }

    const start = parseISO(formData.start_date);
    const end = parseISO(formData.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if start date is in the past
    if (start < today) {
      errors.push("Start date cannot be in the past");
    }

    // Check if end date is before start date
    if (end < start) {
      errors.push("End date must be after start date");
    }

    // Check for overlapping requests
    if (userLeaveRequests.length > 0) {
      const overlapping = userLeaveRequests.some((request) => {
        if (request.status === "rejected") return false;
        const reqStart = parseISO(request.start_date);
        const reqEnd = parseISO(request.end_date);
        return (
          (start >= reqStart && start <= reqEnd) ||
          (end >= reqStart && end <= reqEnd) ||
          (start <= reqStart && end >= reqEnd)
        );
      });

      if (overlapping) {
        errors.push("You have an overlapping leave request");
      }
    }

    // Check if requesting more days than remaining
    // Note: remaining_days is the leave entitlement remaining (excluding bank holidays which are already given)
    if (remainingDays && calculatedDuration > remainingDays.remaining_days) {
      errors.push(
        `You only have ${remainingDays.remaining_days} leave days remaining, but requesting ${calculatedDuration} days`
      );
    }

    setValidationErrors(errors);
  };

  const handleSubmit = async () => {
    if (validationErrors.length > 0) {
      toast({
        title: "Validation Error",
        description: validationErrors.join(", "),
        variant: "destructive",
      });
      return;
    }

    if (calculatedDuration === 0) {
      toast({
        title: "Validation Error",
        description: "Please select a valid date range",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const { error } = await supabase.from("team_leaves").insert({
        user_id: user.id,
        leave_type: formData.leave_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        status: "pending",
        duration_days: calculatedDuration,
        description: formData.description.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "Leave Request Submitted",
        description: "Your leave request has been submitted and is pending approval.",
      });

      setIsDialogOpen(false);
      setFormData({
        leave_type: "Annual Leave",
        start_date: "",
        end_date: "",
        description: "",
      });
      setCalculatedDuration(0);
      setValidationErrors([]);

      if (onLeaveRequested) {
        onLeaveRequested();
      }
    } catch (error: any) {
      toast({
        title: "Error submitting leave request",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
    setFormData({
      leave_type: "Annual Leave",
      start_date: "",
      end_date: "",
      description: "",
    });
    setCalculatedDuration(0);
    setValidationErrors([]);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Button onClick={handleOpenDialog} className="gap-2">
        <Plus className="h-4 w-4" />
        Request Leave
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Remaining Days Info */}
            {remainingDays && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Entitlement:</span>
                      <span className="font-semibold ml-2">{remainingDays.total_entitlement + remainingDays.bank_holidays} days</span>
                     
                    </div>
                    <div>
                      <span className="text-gray-600">Used:</span>
                      <span className="font-semibold ml-2">{remainingDays.used_leave_days} days</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Bank Holidays:</span>
                      <span className="font-semibold ml-2">{remainingDays.bank_holidays} days</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Remaining Leave:</span>
                      <span className="font-semibold ml-2 text-blue-600">{remainingDays.remaining_days} days</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Leave Type */}
            <div className="space-y-2">
              <Label htmlFor="leave-type">Leave Type *</Label>
              <Select
                value={formData.leave_type}
                onValueChange={(value) => setFormData({ ...formData, leave_type: value })}
              >
                <SelectTrigger id="leave-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date *</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  min={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date *</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  min={formData.start_date || format(new Date(), "yyyy-MM-dd")}
                />
              </div>
            </div>

            {/* Duration Calculation */}
            {calculatedDuration > 0 && (
              <Card className="bg-gray-50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">Duration (excluding weekends & bank holidays):</span>
                    <span className="font-semibold">{calculatedDuration} day{calculatedDuration !== 1 ? "s" : ""}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    <div className="space-y-1">
                      {validationErrors.map((error, index) => (
                        <p key={index} className="text-sm text-red-600">
                          {error}
                        </p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add any additional notes or details..."
                rows={4}
              />
            </div>

            {/* User's Leave Requests */}
            {userLeaveRequests.length > 0 && (
              <div className="space-y-2">
                <Label>Your Leave Requests</Label>
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {userLeaveRequests.slice(0, 5).map((request) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{request.leave_type}</div>
                            <div className="text-gray-500 text-xs">
                              {format(parseISO(request.start_date), "MMM d")} -{" "}
                              {format(parseISO(request.end_date), "MMM d, yyyy")} ({request.duration_days} days)
                            </div>
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || validationErrors.length > 0 || calculatedDuration === 0}
            >
              {isLoading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { format, parseISO, isAfter, isBefore, startOfDay } from "date-fns";
import { Users, Calendar as CalendarIcon, CheckCircle2, Clock, Check, X } from "lucide-react";

type LeaveRequest = {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  duration_days: number;
  description?: string;
  created_at: string;
  user_name?: string;
};

type TeamMemberLeaveInfo = {
  user_id: string;
  full_name: string;
  total_entitlement: number;
  used_leave_days: number;
  bank_holidays: number;
  remaining_days: number;
};

type AdminCalendarSidebarProps = {
  isOpen: boolean;
  refreshTrigger?: number;
  onLeaveUpdated?: () => void;
};

export default function AdminCalendarSidebar({ isOpen, refreshTrigger, onLeaveUpdated }: AdminCalendarSidebarProps) {
  const [activeTab, setActiveTab] = useState<"leaves" | "team">("leaves");
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberLeaveInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [approvingLeaveId, setApprovingLeaveId] = useState<string | null>(null);
  const [rejectingLeaveId, setRejectingLeaveId] = useState<string | null>(null);
  const [leaveFilter, setLeaveFilter] = useState<"all" | "current" | "past">("current");
  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      if (activeTab === "leaves") {
        fetchAllLeaves();
      } else if (activeTab === "team") {
        fetchTeamMembersLeaveInfo();
      }
    }
  }, [isOpen, activeTab, refreshTrigger]);

  const fetchAllLeaves = async () => {
    setLeavesLoading(true);
    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;

      // Get user's team_id
      const { data: userInfo } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', effectiveUserId)
        .single();

      if (!userInfo?.team_id) return;

      // Fetch all leaves for the team (RLS will filter)
      const { data: leaves, error } = await supabase
        .from('team_leaves')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get team members to map user_id to names
      const { data: teamMembersData } = await supabase
        .from('business_info')
        .select('user_id, full_name')
        .eq('team_id', userInfo.team_id);

      const membersMap = new Map(
        (teamMembersData || []).map((m: { user_id: any; full_name: any; }) => [m.user_id, m.full_name])
      );

      // Map leaves with user names
      const leavesWithNames = (leaves || []).map((leave: { user_id: unknown; }) => ({
        ...leave,
        user_name: membersMap.get(leave.user_id) || 'Unknown User'
      }));

      setAllLeaves(leavesWithNames);
    } catch (error) {
      console.error("Error fetching all leaves:", error);
    } finally {
      setLeavesLoading(false);
    }
  };

  const fetchTeamMembersLeaveInfo = async () => {
    setTeamLoading(true);
    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;

      const { data: userInfo } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', effectiveUserId)
        .single();

      if (!userInfo?.team_id) return;

      const currentYear = new Date().getFullYear();

      // Get team members
      const { data: teamMembersData, error: teamError } = await supabase
        .from('business_info')
        .select('user_id, full_name')
        .eq('team_id', userInfo.team_id)
        .order('full_name', { ascending: true });

      if (teamError) throw teamError;

      // Calculate leave info for each team member
      const membersWithLeaveInfo = await Promise.all(
        (teamMembersData || []).map(async (member: { user_id: any; full_name: any; }) => {
          try {
            const { data: leaveInfo, error: rpcError } = await supabase.rpc('calculate_remaining_leave_days', {
              p_user_id: member.user_id,
              p_year: currentYear
            });

            if (rpcError) {
              console.error(`Error calculating leave for ${member.full_name}:`, rpcError);
              return {
                user_id: member.user_id,
                full_name: member.full_name,
                total_entitlement: 25,
                used_leave_days: 0,
                bank_holidays: 0,
                remaining_days: 25
              };
            }

            const info = leaveInfo && leaveInfo.length > 0 ? leaveInfo[0] : null;

            if (!info) {
              return {
                user_id: member.user_id,
                full_name: member.full_name,
                total_entitlement: 25,
                used_leave_days: 0,
                bank_holidays: 0,
                remaining_days: 25
              };
            }

            return {
              user_id: member.user_id,
              full_name: member.full_name,
              total_entitlement: info.total_entitlement || 25,
              used_leave_days: info.used_leave_days || 0,
              bank_holidays: info.bank_holidays || 0,
              remaining_days: info.remaining_days || 25
            };
          } catch (error) {
            console.error(`Error processing ${member.full_name}:`, error);
            return {
              user_id: member.user_id,
              full_name: member.full_name,
              total_entitlement: 25,
              used_leave_days: 0,
              bank_holidays: 0,
              remaining_days: 25
            };
          }
        })
      );

      setTeamMembers(membersWithLeaveInfo);
    } catch (error) {
      console.error("Error fetching team members leave info:", error);
    } finally {
      setTeamLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === "approved") {
      return <Badge className="bg-green-600 hover:bg-green-700">Approved</Badge>;
    } else if (statusLower === "pending") {
      return <Badge className="bg-amber-500 hover:bg-amber-600">Pending</Badge>;
    } else if (statusLower === "rejected") {
      return <Badge variant="destructive">Rejected</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  const handleApproveLeave = async (leaveId: string) => {
    setApprovingLeaveId(leaveId);
    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) {
        throw new Error("No authenticated user");
      }

      // Update leave status
      const { error: leaveError } = await supabase
        .from('team_leaves')
        .update({ status: 'approved' })
        .eq('id', leaveId);

      if (leaveError) throw leaveError;

      // Create approval record
      const { error: approvalError } = await supabase
        .from('leave_approvals')
        .insert({
          leave_id: leaveId,
          approver_id: effectiveUserId,
          action: 'approved',
          comments: null
        });

      if (approvalError) throw approvalError;

      toast({
        title: "Leave Approved",
        description: "The leave request has been approved successfully.",
      });

      // Refresh leaves list
      await fetchAllLeaves();
      
      // Trigger parent refresh
      if (onLeaveUpdated) {
        onLeaveUpdated();
      }
    } catch (error: any) {
      toast({
        title: "Error approving leave",
        description: error.message || "Failed to approve leave request",
        variant: "destructive",
      });
    } finally {
      setApprovingLeaveId(null);
    }
  };

  const handleRejectLeave = async (leaveId: string) => {
    setRejectingLeaveId(leaveId);
    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) {
        throw new Error("No authenticated user");
      }

      // Update leave status
      const { error: leaveError } = await supabase
        .from('team_leaves')
        .update({ status: 'rejected' })
        .eq('id', leaveId);

      if (leaveError) throw leaveError;

      // Create approval record
      const { error: approvalError } = await supabase
        .from('leave_approvals')
        .insert({
          leave_id: leaveId,
          approver_id: effectiveUserId,
          action: 'rejected',
          comments: null
        });

      if (approvalError) throw approvalError;

      toast({
        title: "Leave Rejected",
        description: "The leave request has been rejected successfully.",
      });

      // Refresh leaves list
      await fetchAllLeaves();
      
      // Trigger parent refresh
      if (onLeaveUpdated) {
        onLeaveUpdated();
      }
    } catch (error: any) {
      toast({
        title: "Error rejecting leave",
        description: error.message || "Failed to reject leave request",
        variant: "destructive",
      });
    } finally {
      setRejectingLeaveId(null);
    }
  };

  // Filter leaves based on date
  const filterLeavesByDate = (leaves: LeaveRequest[]) => {
    const today = startOfDay(new Date());
    
    switch (leaveFilter) {
      case "current":
        // Show only current and upcoming leaves (end_date >= today)
        return leaves.filter(leave => {
          const endDate = startOfDay(parseISO(leave.end_date));
          return isAfter(endDate, today) || endDate.getTime() >= today.getTime();
        });
      case "past":
        // Show only past/completed leaves (end_date < today)
        return leaves.filter(leave => {
          const endDate = startOfDay(parseISO(leave.end_date));
          return isBefore(endDate, today);
        });
      case "all":
      default:
        return leaves;
    }
  };

  const filteredLeaves = filterLeavesByDate(allLeaves);
  const approvedLeaves = filteredLeaves.filter(l => l.status.toLowerCase() === "approved");
  const pendingLeaves = filteredLeaves.filter(l => l.status.toLowerCase() === "pending");

  if (!isOpen) return null;

  return (
    <Card className="w-80 border-l border-gray-200 flex flex-col" style={{ height: '600px' }}>
      <CardContent className="p-0 flex flex-col h-full">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "leaves" | "team")} className="flex flex-col h-full">
        <div className="border-b border-gray-200 p-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="leaves" className="text-xs sm:text-sm">
              <CalendarIcon className="h-4 w-4 mr-1.5" />
              Leaves
            </TabsTrigger>
            <TabsTrigger value="team" className="text-xs sm:text-sm">
              <Users className="h-4 w-4 mr-1.5" />
              Team
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="leaves" className="flex-1 m-0 mt-0 overflow-hidden flex flex-col">
            <div className="px-4 pt-3 pb-2 border-b border-gray-200 bg-gray-50/50">
              <Select value={leaveFilter} onValueChange={(value) => setLeaveFilter(value as "all" | "current" | "past")}>
                  <SelectTrigger className="h-8 text-xs w-full border-none shadow-none rounded-none">
                    <SelectValue placeholder="Filter leaves" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current & Upcoming</SelectItem>
                    <SelectItem value="past">Past/Completed</SelectItem>
                    <SelectItem value="all">All Leaves</SelectItem>
                  </SelectContent>
                </Select>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {leavesLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Spinner className="h-6 w-6 text-blue-600" />
                  </div>
                ) : (
                  <>
                    {/* Pending Leaves */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <h3 className="text-sm font-semibold text-gray-900">Pending ({pendingLeaves.length})</h3>
                      </div>
                      {pendingLeaves.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-4">No pending leaves</p>
                      ) : (
                        <div className="space-y-2">
                          {pendingLeaves.map((leave) => (
                            <Card key={leave.id} className="">
                              <CardContent className="p-3">
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-gray-900 truncate">
                                        {leave.user_name}
                                      </p>
                                      <p className="text-xs text-gray-600 mt-0.5">{leave.leave_type}</p>
                                    </div>
                                    {getStatusBadge(leave.status)}
                                  </div>
                                  <div className="flex items-center gap-2 justify-between">
                                    <div className="text-xs text-gray-500">
                                      {format(parseISO(leave.start_date), "MMM d")} - {format(parseISO(leave.end_date), "MMM d, yyyy")}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {leave.duration_days} day{leave.duration_days !== 1 ? 's' : ''}
                                    </div>
                                  </div>
                                  {/* Approve/Reject Buttons */}
                                  <div className="flex items-center gap-2 pt-1 border-t">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 h-7 text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                      onClick={() => handleApproveLeave(leave.id)}
                                      disabled={approvingLeaveId === leave.id || rejectingLeaveId === leave.id}
                                    >
                                      {approvingLeaveId === leave.id ? (
                                        <Spinner className="h-3 w-3 mr-1" />
                                      ) : (
                                        <Check className="h-3 w-3 mr-1" />
                                      )}
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 h-7 text-xs bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                      onClick={() => handleRejectLeave(leave.id)}
                                      disabled={approvingLeaveId === leave.id || rejectingLeaveId === leave.id}
                                    >
                                      {rejectingLeaveId === leave.id ? (
                                        <Spinner className="h-3 w-3 mr-1" />
                                      ) : (
                                        <X className="h-3 w-3 mr-1" />
                                      )}
                                      Reject
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Approved Leaves */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <h3 className="text-sm font-semibold text-gray-900">Approved ({approvedLeaves.length})</h3>
                      </div>
                      {approvedLeaves.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-4">No approved leaves</p>
                      ) : (
                        <div className="space-y-2">
                          {approvedLeaves.map((leave) => (
                            <Card key={leave.id} className="">
                              <CardContent className="p-3">
                                <div className="space-y-1.5">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-gray-900 truncate">
                                        {leave.user_name}
                                      </p>
                                      <p className="text-xs text-gray-600 mt-0.5">{leave.leave_type}</p>
                                    </div>
                                    {getStatusBadge(leave.status)}
                                  </div>
                                  <div className="flex items-center gap-2 justify-between">
                                    <div className="text-xs text-gray-500">
                                      {format(parseISO(leave.start_date), "MMM d")} - {format(parseISO(leave.end_date), "MMM d, yyyy")}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {leave.duration_days} day{leave.duration_days !== 1 ? 's' : ''}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

        <TabsContent value="team" className="flex-1 m-0 mt-0 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {teamLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Spinner className="h-6 w-6 text-blue-600" />
                  </div>
                ) : teamMembers.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-8">No team members found</p>
                ) : (
                  teamMembers.map((member) => (
                    <Card key={member.user_id}>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900">{member.full_name}</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-gray-500">Total Entitlement</p>
                              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                                {member.total_entitlement + member.bank_holidays} days
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Used</p>
                              <p className="text-sm font-semibold text-amber-600 mt-0.5">
                                {member.used_leave_days} days
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Bank Holidays</p>
                              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                                {member.bank_holidays} days
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Remaining Leave</p>
                              <p className={`text-sm font-semibold mt-0.5 ${
                                member.remaining_days < 5 ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {member.remaining_days} days
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

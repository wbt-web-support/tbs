"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar, Users, Check, X, Clock, Eye, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { getTeamMemberIds } from "@/utils/supabase/teams";

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
  user_name: string;
  approver_name?: string;
  approval_comments?: string;
  approval_date?: string;
};

export default function LeaveApprovals() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [currentLeave, setCurrentLeave] = useState<LeaveRequest | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('user');
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchLeaveRequests();
    }
  }, [isAdmin]);

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
      setCurrentUserRole(role);
      setIsAdmin(role === 'admin');
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  };

  const fetchLeaveRequests = async () => {
    setIsLoading(true);
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

      // Get all leave requests for the team
      const { data: leaves, error: leavesError } = await supabase
        .from('team_leaves')
        .select('*')
        .in('user_id', teamMemberIds)
        .in('status', ['pending', 'approved', 'rejected'])
        .order('created_at', { ascending: false });

      if (leavesError) throw leavesError;

      // Get team member names
      const { data: teamMembers, error: teamError } = await supabase
        .from('business_info')
        .select('user_id, full_name')
        .eq('team_id', userInfo.team_id);

      if (teamError) throw teamError;

      // Get approval information
      const leaveIds = leaves?.map(l => l.id) || [];
      const { data: approvals } = await supabase
        .from('leave_approvals')
        .select(`
          leave_id,
          action,
          comments,
          created_at,
          approver:business_info(full_name)
        `)
        .in('leave_id', leaveIds)
        .order('created_at', { ascending: false });

      // Combine the data
      const leavesWithDetails = leaves?.map(leave => {
        const teamMember = teamMembers?.find(m => m.user_id === leave.user_id);
        const approval = approvals?.find(a => a.leave_id === leave.id);
        
        return {
          ...leave,
          user_name: teamMember?.full_name || 'Unknown User',
          approver_name: approval?.approver?.full_name,
          approval_comments: approval?.comments,
          approval_date: approval?.created_at
        };
      }) || [];

      setLeaveRequests(leavesWithDetails);
    } catch (error: any) {
      toast({
        title: "Error fetching leave requests",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproval = async () => {
    if (!currentLeave) return;

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      // Update leave status
      const { error: leaveError } = await supabase
        .from('team_leaves')
        .update({ status: approvalAction === 'approve' ? 'approved' : 'rejected' })
        .eq('id', currentLeave.id);

      if (leaveError) throw leaveError;

      // Create approval record
      const { error: approvalError } = await supabase
        .from('leave_approvals')
        .insert({
          leave_id: currentLeave.id,
          approver_id: user.id,
          action: approvalAction === 'approve' ? 'approved' : 'rejected',
          comments: comments.trim() || null
        });

      if (approvalError) throw approvalError;

      toast({
        title: `Leave ${approvalAction === 'approve' ? 'Approved' : 'Rejected'}`,
        description: `The leave request has been ${approvalAction === 'approve' ? 'approved' : 'rejected'} successfully.`,
      });

      fetchLeaveRequests();
      setIsApprovalDialogOpen(false);
      setComments('');
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

  const openApprovalDialog = (leave: LeaveRequest, action: 'approve' | 'reject') => {
    setCurrentLeave(leave);
    setApprovalAction(action);
    setComments('');
    setIsApprovalDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="flex items-center gap-1"><Check className="h-3 w-3" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="flex items-center gap-1"><X className="h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6 py-4">
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
          <p className="text-gray-500">Only team administrators can approve leave requests.</p>
        </div>
      </div>
    );
  }

  const pendingRequests = leaveRequests.filter(r => r.status === 'pending');
  const processedRequests = leaveRequests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start pb-4 border-b">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-blue-600" />
            Leave Approvals
          </h2>
          <p className="text-sm text-gray-500 mt-1.5">
            Review and approve leave requests from your team
          </p>
        </div>
      </div>

      {isLoading && leaveRequests.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
            <p className="text-sm text-gray-500">Loading leave requests...</p>
          </div>
        </div>
      ) : (
        <>
      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Requests ({pendingRequests.length})
          </CardTitle>
          <CardDescription>
            Leave requests awaiting your approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600"></div>
                <p className="text-sm text-gray-500">Loading...</p>
              </div>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-8">
              <Check className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
              <p className="text-gray-500">No pending leave requests to review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div key={request.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">{request.user_name}</h3>
                      <p className="text-sm text-gray-500">
                        {format(new Date(request.start_date), "MMM d")} - {format(new Date(request.end_date), "MMM d, yyyy")} 
                        ({request.duration_days} day{request.duration_days !== 1 ? 's' : ''})
                      </p>
                      {request.description && (
                        <p className="text-sm text-gray-600 mt-1">{request.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(request.status)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => openApprovalDialog(request, 'approve')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openApprovalDialog(request, 'reject')}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processed Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Processed Requests ({processedRequests.length})
          </CardTitle>
          <CardDescription>
            Previously approved or rejected leave requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {processedRequests.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No processed requests yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {processedRequests.map((request) => (
                <div key={request.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">{request.user_name}</h3>
                      <p className="text-sm text-gray-500">
                        {format(new Date(request.start_date), "MMM d")} - {format(new Date(request.end_date), "MMM d, yyyy")} 
                        ({request.duration_days} day{request.duration_days !== 1 ? 's' : ''})
                      </p>
                      {request.description && (
                        <p className="text-sm text-gray-600 mt-1">{request.description}</p>
                      )}
                      {request.approver_name && request.approval_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          {request.status === 'approved' ? 'Approved' : 'Rejected'} by {request.approver_name} on {format(new Date(request.approval_date), "MMM d, yyyy")}
                        </p>
                      )}
                      {request.approval_comments && (
                        <p className="text-sm text-gray-600 mt-1 italic">"{request.approval_comments}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(request.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Approve' : 'Reject'} Leave Request
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {currentLeave && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Employee</Label>
                  <p className="text-sm text-gray-600">{currentLeave.user_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Leave Period</Label>
                  <p className="text-sm text-gray-600">
                    {format(new Date(currentLeave.start_date), "MMM d, yyyy")} - {format(new Date(currentLeave.end_date), "MMM d, yyyy")} 
                    ({currentLeave.duration_days} day{currentLeave.duration_days !== 1 ? 's' : ''})
                  </p>
                </div>
                {currentLeave.description && (
                  <div>
                    <Label className="text-sm font-medium">Reason</Label>
                    <p className="text-sm text-gray-600">{currentLeave.description}</p>
                  </div>
                )}
                <div>
                  <Label htmlFor="comments" className="text-sm font-medium">
                    Comments (Optional)
                  </Label>
                  <Textarea
                    id="comments"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder={`Add a comment for this ${approvalAction === 'approve' ? 'approval' : 'rejection'}...`}
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>
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
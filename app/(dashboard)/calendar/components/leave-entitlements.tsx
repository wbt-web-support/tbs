"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar, Users, Settings, Plus, Edit, Trash2 } from "lucide-react";
import { getTeamMemberIds } from "@/utils/supabase/teams";

type LeaveEntitlement = {
  id: string;
  team_id: string;
  total_entitlement_days: number;
  year: number;
  created_at: string;
  updated_at: string;
};

type TeamMemberLeaveInfo = {
  user_id: string;
  full_name: string;
  total_entitlement: number;
  used_leave_days: number;
  bank_holidays: number;
  remaining_days: number;
};

type TeamMember = {
  user_id: string;
  full_name: string;
};

export default function LeaveEntitlements() {
  const [entitlements, setEntitlements] = useState<LeaveEntitlement[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberLeaveInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentEntitlement, setCurrentEntitlement] = useState<LeaveEntitlement | null>(null);
  const [formData, setFormData] = useState({
    total_entitlement_days: 25,
    year: new Date().getFullYear()
  });
  const [currentUserRole, setCurrentUserRole] = useState<string>('user');
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchEntitlements();
      fetchTeamMembersLeaveInfo();
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

  const fetchEntitlements = async () => {
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

      const { data, error } = await supabase
        .from('leave_entitlements')
        .select('*')
        .eq('team_id', userInfo.team_id)
        .order('year', { ascending: false });

      if (error) throw error;
      setEntitlements(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching entitlements",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeamMembersLeaveInfo = async () => {
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
      const currentYear = new Date().getFullYear();

      // Get team members with their leave info
      const { data: teamMembersData, error: teamError } = await supabase
        .from('business_info')
        .select('user_id, full_name')
        .eq('team_id', userInfo.team_id)
        .order('full_name', { ascending: true });

      if (teamError) throw teamError;

      // Calculate leave info for each team member
      const membersWithLeaveInfo = await Promise.all(
        (teamMembersData || []).map(async (member: TeamMember) => {
          const { data: leaveInfo } = await supabase.rpc('calculate_remaining_leave_days', {
            p_user_id: member.user_id,
            p_year: currentYear
          });

          return {
            user_id: member.user_id,
            full_name: member.full_name,
            total_entitlement: leaveInfo?.[0]?.total_entitlement || 25,
            used_leave_days: leaveInfo?.[0]?.used_leave_days || 0,
            bank_holidays: leaveInfo?.[0]?.bank_holidays || 0,
            remaining_days: leaveInfo?.[0]?.remaining_days || 25
          };
        }) || []
      );

      setTeamMembers(membersWithLeaveInfo);
    } catch (error: any) {
      console.error("Error fetching team members leave info:", error);
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

      if (currentEntitlement) {
        // Update existing entitlement
        const { error } = await supabase
          .from('leave_entitlements')
          .update({
            total_entitlement_days: formData.total_entitlement_days,
            year: formData.year
          })
          .eq('id', currentEntitlement.id);

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
            total_entitlement_days: formData.total_entitlement_days,
            year: formData.year
          });

        if (error) throw error;
        toast({
          title: "Entitlement created",
          description: "Leave entitlement has been created successfully.",
        });
      }

      fetchEntitlements();
      fetchTeamMembersLeaveInfo();
      setIsDialogOpen(false);
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
      fetchTeamMembersLeaveInfo();
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

  const handleAddEntitlement = () => {
    setCurrentEntitlement(null);
    setFormData({
      total_entitlement_days: 25,
      year: new Date().getFullYear()
    });
    setIsDialogOpen(true);
  };

  const handleEditEntitlement = (entitlement: LeaveEntitlement) => {
    setCurrentEntitlement(entitlement);
    setFormData({
      total_entitlement_days: entitlement.total_entitlement_days,
      year: entitlement.year
    });
    setIsDialogOpen(true);
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6 py-4">
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
          <p className="text-gray-500">Only team administrators can manage leave entitlements.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Leave Entitlements</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage leave entitlements for your team.
          </p>
        </div>
        <Button onClick={handleAddEntitlement} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Add Entitlement
        </Button>
      </div>

      {/* Team Members Leave Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Leave Summary ({new Date().getFullYear()})
          </CardTitle>
          <CardDescription>
            Overview of leave usage for all team members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map((member) => (
              <div key={member.user_id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{member.full_name}</h3>
                  <Badge 
                    variant={member.remaining_days < 5 ? "destructive" : "default"}
                    className="text-xs"
                  >
                    {member.remaining_days} days left
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Total Entitlement:</span>
                    <span>{member.total_entitlement} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Used Leave:</span>
                    <span>{member.used_leave_days} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bank Holidays:</span>
                    <span>{member.bank_holidays} days</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Entitlements List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Leave Entitlements
          </CardTitle>
          <CardDescription>
            Configure leave entitlements by year
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : entitlements.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Entitlements</h3>
              <p className="text-gray-500 mb-4">Create your first leave entitlement to get started.</p>
              <Button onClick={handleAddEntitlement} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Entitlement
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {entitlements.map((entitlement) => (
                <div key={entitlement.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">{entitlement.year}</h3>
                    <p className="text-sm text-gray-500">
                      {entitlement.total_entitlement_days} days total entitlement
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditEntitlement(entitlement)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteEntitlement(entitlement.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Entitlement Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {currentEntitlement ? "Edit Leave Entitlement" : "Add Leave Entitlement"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="year" className="text-right">
                Year
              </Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                className="col-span-3"
                min={new Date().getFullYear() - 5}
                max={new Date().getFullYear() + 5}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="days" className="text-right">
                Days
              </Label>
              <Input
                id="days"
                type="number"
                value={formData.total_entitlement_days}
                onChange={(e) => setFormData({ ...formData, total_entitlement_days: parseInt(e.target.value) })}
                className="col-span-3"
                min="1"
                max="365"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEntitlement} disabled={isLoading}>
              {currentEntitlement ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
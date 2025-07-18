"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Pencil, Trash2, Users, Search } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Benefit = {
  id: string;
  benefit_name: string;
  notes: string | null;
  iframe: string | null;
  created_at: string;
  updated_at: string;
};

type Team = {
  id: string;
  full_name: string;
  business_name: string;
  team_id: string;
};

type TeamBenefitStatus = {
  id: string;
  team_id: string;
  benefit_id: string;
  is_disabled: boolean;
  disabled_at: string | null;
  team?: Team;
  benefit?: Benefit;
};

export default function AdminBenefitsPage() {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);
  const [teamBenefitStatuses, setTeamBenefitStatuses] = useState<TeamBenefitStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null);
  const [formData, setFormData] = useState({
    benefit_name: "",
    notes: "",
    iframe: "",
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("benefits");
  const [teamSearchTerm, setTeamSearchTerm] = useState("");
  const supabase = createClient();

  useEffect(() => {
    fetchBenefits();
    fetchTeams();
    fetchTeamBenefitStatuses();
  }, []);

  useEffect(() => {
    // Filter teams based on search term
    if (teamSearchTerm.trim() === "") {
      setFilteredTeams(teams);
    } else {
      const filtered = teams.filter(team => 
        team.business_name.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
        team.full_name.toLowerCase().includes(teamSearchTerm.toLowerCase())
      );
      setFilteredTeams(filtered);
    }
  }, [teams, teamSearchTerm]);

  const fetchBenefits = async () => {
    try {
      console.log("Fetching benefits...");
      const { data, error } = await supabase
        .from("chq_benefits")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      console.log("Fetched benefits:", data);
      setBenefits(data || []);
    } catch (error) {
      console.error("Error fetching benefits:", error);
      toast.error("Failed to load benefits");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from("business_info")
        .select("id, full_name, business_name, team_id")
        .not("team_id", "is", null)
        .order("business_name", { ascending: true });

      if (error) throw error;
      
      // Group by team_id and take the first business_info for each team
      const uniqueTeams = data?.reduce((acc: Team[], curr) => {
        if (!acc.find(team => team.team_id === curr.team_id)) {
          acc.push({
            id: curr.id,
            full_name: curr.full_name,
            business_name: curr.business_name,
            team_id: curr.team_id,
          });
        }
        return acc;
      }, []) || [];

      setTeams(uniqueTeams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      toast.error("Failed to load teams");
    } finally {
      setTeamsLoading(false);
    }
  };

  const fetchTeamBenefitStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from("team_benefit_status")
        .select("*");

      if (error) throw error;
      setTeamBenefitStatuses(data || []);
    } catch (error) {
      console.error("Error fetching team benefit statuses:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      if (editingBenefit) {
        const { error } = await supabase
          .from("chq_benefits")
          .update(formData)
          .eq("id", editingBenefit.id);

        if (error) throw error;
        toast.success("Benefit updated successfully");
      } else {
        const { error } = await supabase
          .from("chq_benefits")
          .insert([formData]);

        if (error) throw error;
        toast.success("Benefit created successfully");
      }

      setIsDialogOpen(false);
      setEditingBenefit(null);
      setFormData({
        benefit_name: "",
        notes: "",
        iframe: "",
      });
      fetchBenefits();
    } catch (error) {
      console.error("Error saving benefit:", error);
      toast.error("Failed to save benefit");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEdit = (benefit: Benefit) => {
    setEditingBenefit(benefit);
    setFormData({
      benefit_name: benefit.benefit_name,
      notes: benefit.notes || "",
      iframe: benefit.iframe || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this benefit?")) return;

    setDeleteLoading(id);
    try {
      const { error } = await supabase
        .from("chq_benefits")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Benefit deleted successfully");
      fetchBenefits();
    } catch (error) {
      console.error("Error deleting benefit:", error);
      toast.error("Failed to delete benefit");
    } finally {
      setDeleteLoading(null);
    }
  };

  const toggleTeamBenefit = async (teamId: string, benefitId: string, currentlyDisabled: boolean) => {
    const toggleKey = `${teamId}-${benefitId}`;
    setToggleLoading(toggleKey);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const newDisabledState = !currentlyDisabled;

      // Check if status entry exists
      const { data: existing, error: selectError } = await supabase
        .from("team_benefit_status")
        .select("id")
        .eq("team_id", teamId)
        .eq("benefit_id", benefitId)
        .maybeSingle();

      if (selectError) throw selectError;

      if (existing) {
        // Update existing status
        const { error } = await supabase
          .from("team_benefit_status")
          .update({
            is_disabled: newDisabledState,
            disabled_by: newDisabledState ? user.id : null,
            disabled_at: newDisabledState ? new Date().toISOString() : null,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Create new status entry
        const { error } = await supabase
          .from("team_benefit_status")
          .insert([{
            team_id: teamId,
            benefit_id: benefitId,
            is_disabled: newDisabledState,
            disabled_by: newDisabledState ? user.id : null,
            disabled_at: newDisabledState ? new Date().toISOString() : null,
          }]);

        if (error) throw error;
      }

      toast.success(`Benefit ${newDisabledState ? 'disabled' : 'enabled'} for team`);
      await fetchTeamBenefitStatuses();
    } catch (error) {
      console.error("Error updating team benefit status:", error);
      toast.error("Failed to update team benefit status");
    } finally {
      setToggleLoading(null);
    }
  };

  const getTeamBenefitStatus = (teamId: string, benefitId: string): boolean => {
    const status = teamBenefitStatuses.find(
      s => s.team_id === teamId && s.benefit_id === benefitId
    );
    return status?.is_disabled || false;
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
        <h1 className="text-2xl font-bold">Manage Benefits & Users</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="benefits">Benefits</TabsTrigger>
          <TabsTrigger value="teams">User Benefit Management</TabsTrigger>
        </TabsList>

        <TabsContent value="benefits" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Benefits Management</h2>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Benefit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingBenefit ? "Edit Benefit" : "Add New Benefit"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="benefit_name">Benefit Name</Label>
                    <Input
                      id="benefit_name"
                      value={formData.benefit_name}
                      onChange={(e) =>
                        setFormData({ ...formData, benefit_name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="iframe">Calendar Booking Iframe</Label>
                    <Textarea
                      id="iframe"
                      value={formData.iframe}
                      onChange={(e) =>
                        setFormData({ ...formData, iframe: e.target.value })
                      }
                      placeholder="<iframe src='https://calendly.com/...' ...></iframe>"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Paste the complete iframe code for the calendar booking widget
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={submitLoading}>
                    {submitLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {editingBenefit ? "Updating..." : "Creating..."}
                      </>
                    ) : (
                      <>{editingBenefit ? "Update" : "Create"}</>
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {benefits.length === 0 && !loading ? (
              <div className="p-4 text-center text-gray-500">
                No benefits found. Create your first benefit by clicking the "Add Benefit" button above.
              </div>
            ) : (
              benefits.map((benefit) => (
                <Card key={benefit.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <h3 className="font-medium">{benefit.benefit_name}</h3>
                      {benefit.notes && (
                        <p className="text-sm text-muted-foreground">
                          {benefit.notes}
                        </p>
                      )}
                      {benefit.iframe && (
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600">
                            Calendar Booking Available
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            Iframe configured for team bookings
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(benefit)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(benefit.id)}
                        disabled={deleteLoading === benefit.id}
                      >
                        {deleteLoading === benefit.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <h2 className="text-lg font-semibold">User Benefit Management</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage which benefits are available for each user/team. Disabled benefits will not appear in the user's to-do list.
          </p>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search teams by business name or contact name..."
              value={teamSearchTerm}
              onChange={(e) => setTeamSearchTerm(e.target.value)}
              className="pl-10 max-w-md"
            />
          </div>
          
          {teamsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTeams.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {teamSearchTerm ? 
                    `No teams found matching "${teamSearchTerm}"` : 
                    "No teams found"
                  }
                </div>
              ) : (
                filteredTeams.map((team) => (
                  <Card key={team.id} className="p-4">
                    <div className="space-y-3">
                      <div className="border-b pb-2">
                        <h3 className="font-medium text-lg">{team.business_name}</h3>
                        <p className="text-sm text-muted-foreground">{team.full_name}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Available Benefits:</h4>
                        <div className="space-y-2">
                          {benefits.map((benefit) => {
                            const isDisabled = getTeamBenefitStatus(team.team_id, benefit.id);
                            const toggleKey = `${team.team_id}-${benefit.id}`;
                            const isLoading = toggleLoading === toggleKey;
                            
                            return (
                              <div
                                key={benefit.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <span className="text-sm font-medium">{benefit.benefit_name}</span>
                                    {benefit.iframe && (
                                      <Badge variant="outline" className="ml-2 text-xs bg-blue-50 text-blue-600">
                                        Calendar
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label htmlFor={`switch-${toggleKey}`} className="text-xs text-muted-foreground">
                                    {isDisabled ? 'Disabled' : 'Enabled'}
                                  </Label>
                                  {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                  ) : (
                                    <Switch
                                      id={`switch-${toggleKey}`}
                                      checked={!isDisabled}
                                      onCheckedChange={() => toggleTeamBenefit(team.team_id, benefit.id, isDisabled)}
                                      disabled={isLoading}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar, Plus, Edit, Trash2, X } from "lucide-react";
import { format, parseISO } from "date-fns";

type BankHoliday = {
  id: string;
  holiday_name: string;
  holiday_date: string;
  year: number;
  is_active: boolean;
  team_id?: string;
  created_at?: string;
  updated_at?: string;
};

type BankHolidaysManagerProps = {
  onHolidaysUpdated?: () => void;
};

export default function BankHolidaysManager({ onHolidaysUpdated }: BankHolidaysManagerProps) {
  const [holidays, setHolidays] = useState<BankHoliday[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentHoliday, setCurrentHoliday] = useState<BankHoliday | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [formData, setFormData] = useState({
    holiday_name: "",
    holiday_date: "",
    year: new Date().getFullYear(),
    is_active: true,
  });
  const [currentUserRole, setCurrentUserRole] = useState<string>("user");
  const [isAdmin, setIsAdmin] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (isAdmin && teamId) {
      fetchHolidays();
    }
  }, [isAdmin, selectedYear, teamId]);

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userInfo } = await supabase
        .from("business_info")
        .select("role, team_id")
        .eq("user_id", user.id)
        .single();

      const role = userInfo?.role || "user";
      setCurrentUserRole(role);
      setIsAdmin(role === "admin");
      setTeamId(userInfo?.team_id || null);
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  };

  const fetchHolidays = async () => {
    if (!teamId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("bank_holidays")
        .select("*")
        .eq("team_id", teamId)
        .eq("year", selectedYear)
        .order("holiday_date", { ascending: true });

      if (error) throw error;
      setHolidays(data || []);
    } catch (error: any) {
      console.error("Error fetching holidays:", error);
      toast({
        title: "Error fetching holidays",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (holiday?: BankHoliday) => {
    if (holiday) {
      setCurrentHoliday(holiday);
      setFormData({
        holiday_name: holiday.holiday_name,
        holiday_date: holiday.holiday_date,
        year: holiday.year,
        is_active: holiday.is_active,
      });
    } else {
      setCurrentHoliday(null);
      setFormData({
        holiday_name: "",
        holiday_date: "",
        year: selectedYear,
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setCurrentHoliday(null);
    setFormData({
      holiday_name: "",
      holiday_date: "",
      year: selectedYear,
      is_active: true,
    });
  };

  const handleSaveHoliday = async () => {
    if (!formData.holiday_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Holiday name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.holiday_date) {
      toast({
        title: "Validation Error",
        description: "Holiday date is required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      if (currentHoliday) {
        // Update existing holiday
        const { error } = await supabase
          .from("bank_holidays")
          .update({
            holiday_name: formData.holiday_name.trim(),
            holiday_date: formData.holiday_date,
            year: formData.year,
            is_active: formData.is_active,
          })
          .eq("id", currentHoliday.id);

        if (error) throw error;
        toast({
          title: "Holiday updated",
          description: "Bank holiday has been updated successfully.",
        });
      } else {
        // Create new holiday
        if (!teamId) {
          toast({
            title: "Error",
            description: "Team ID not found. Please refresh the page.",
            variant: "destructive",
          });
          return;
        }
        
        const { error } = await supabase.from("bank_holidays").insert({
          holiday_name: formData.holiday_name.trim(),
          holiday_date: formData.holiday_date,
          year: formData.year,
          is_active: formData.is_active,
          team_id: teamId,
        });

        if (error) throw error;
        toast({
          title: "Holiday created",
          description: "Bank holiday has been created successfully.",
        });
      }

      fetchHolidays();
      handleCloseDialog();
      if (onHolidaysUpdated) {
        onHolidaysUpdated();
      }
    } catch (error: any) {
      toast({
        title: "Error saving holiday",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteHoliday = async () => {
    if (!currentHoliday) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("bank_holidays")
        .delete()
        .eq("id", currentHoliday.id);

      if (error) throw error;
      toast({
        title: "Holiday deleted",
        description: "Bank holiday has been deleted successfully.",
      });

      fetchHolidays();
      setIsDeleteDialogOpen(false);
      setCurrentHoliday(null);
      if (onHolidaysUpdated) {
        onHolidaysUpdated();
      }
    } catch (error: any) {
      toast({
        title: "Error deleting holiday",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (holiday: BankHoliday) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("bank_holidays")
        .update({ is_active: !holiday.is_active })
        .eq("id", holiday.id);

      if (error) throw error;
      toast({
        title: `Holiday ${!holiday.is_active ? "activated" : "deactivated"}`,
        description: `Bank holiday has been ${!holiday.is_active ? "activated" : "deactivated"} successfully.`,
      });

      fetchHolidays();
      if (onHolidaysUpdated) {
        onHolidaysUpdated();
      }
    } catch (error: any) {
      toast({
        title: "Error updating holiday",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Only team administrators can manage bank holidays.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              Bank Holidays Management
            </h2>
            <p className="text-sm text-gray-500 mt-1.5">Manage bank holidays for your team</p>
          </div>
          <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Holiday
          </Button>
        </div>
        {isLoading && holidays.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
              <p className="text-sm text-gray-500">Loading holidays...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Year Filter */}
            <div className="flex items-center gap-4">
              <Label htmlFor="year-select">Filter by Year:</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger id="year-select" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableYears().map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline">{holidays.length} holidays</Badge>
            </div>

            {/* Holidays List */}
            {isLoading && holidays.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Loading holidays...</div>
            ) : holidays.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No holidays found for {selectedYear}</div>
            ) : (
              <div className="space-y-2">
                {holidays.map((holiday) => (
                  <Card key={holiday.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900">{holiday.holiday_name}</h4>
                            <Badge variant={holiday.is_active ? "default" : "secondary"}>
                              {holiday.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">
                            {format(parseISO(holiday.holiday_date), "EEEE, MMMM d, yyyy")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={holiday.is_active}
                            onCheckedChange={() => handleToggleActive(holiday)}
                            disabled={isLoading}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(holiday)}
                            disabled={isLoading}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCurrentHoliday(holiday);
                              setIsDeleteDialogOpen(true);
                            }}
                            disabled={isLoading}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentHoliday ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="holiday-name">Holiday Name *</Label>
              <Input
                id="holiday-name"
                value={formData.holiday_name}
                onChange={(e) => setFormData({ ...formData, holiday_name: e.target.value })}
                placeholder="e.g., New Year's Day"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holiday-date">Holiday Date *</Label>
              <Input
                id="holiday-date"
                type="date"
                value={formData.holiday_date}
                onChange={(e) => setFormData({ ...formData, holiday_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holiday-year">Year</Label>
              <Select
                value={formData.year.toString()}
                onValueChange={(value) => setFormData({ ...formData, year: parseInt(value) })}
              >
                <SelectTrigger id="holiday-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableYears().map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is-active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveHoliday} disabled={isLoading}>
              {currentHoliday ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Holiday</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            Are you sure you want to delete "{currentHoliday?.holiday_name}"? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteHoliday} disabled={isLoading}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


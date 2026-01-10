"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Pencil, Trash2, Search, Filter, ExternalLink } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamMemberIds } from "@/utils/supabase/teams";
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
import { Card } from "@/components/ui/card";
import { Input, ExpandableInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  DepartmentDropdown, 
  DepartmentFilterDropdown,
} from "@/components/ui/dropdown-helpers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Department = {
  id: string;
  name: string;
};

type SoftwareData = {
  id: string;
  software: string;
  url: string | null;
  description: string | null;
  price_monthly: number | null;
  pricing_period: 'monthly' | 'yearly' | 'custom' | 'n/a' | null;
  department_id: string | null;
  department?: Department;
  team_id: string;
  created_at: string;
  updated_at: string;
};

export default function SoftwareTrackerPage() {
  const [softwareData, setSoftwareData] = useState<SoftwareData[]>([]);
  const [filteredData, setFilteredData] = useState<SoftwareData[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentSoftware, setCurrentSoftware] = useState<SoftwareData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [activeDepartment, setActiveDepartment] = useState<string>("all");
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<Omit<SoftwareData, 'id' | 'team_id' | 'created_at' | 'updated_at' | 'department'>>({
    software: "",
    url: "",
    description: "",
    price_monthly: null,
    pricing_period: 'monthly',
    department_id: null,
  });
  
  const supabase = createClient();

  useEffect(() => {
    fetchSoftwareData();
    fetchDropdownData();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === "" && activeDepartment === "all") {
      setFilteredData(softwareData);
    } else {
      let filtered = softwareData;
      
      // Filter by department if not "all"
      if (activeDepartment !== "all") {
        filtered = filtered.filter(software => 
          software.department_id === activeDepartment
        );
      }
      
      // Filter by search term if provided
      if (searchTerm.trim() !== "") {
        const lowercasedSearch = searchTerm.toLowerCase();
        filtered = filtered.filter(software => 
          software.software.toLowerCase().includes(lowercasedSearch) ||
          software.description?.toLowerCase().includes(lowercasedSearch) ||
          software.url?.toLowerCase().includes(lowercasedSearch)
        );
      }
      
      setFilteredData(filtered);
    }
  }, [searchTerm, activeDepartment, softwareData]);

  const fetchSoftwareData = async () => {
    try {
      setLoading(true);
      
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) throw new Error("No effective user ID");
      
      const teamMemberIds = await getTeamMemberIds(supabase, effectiveUserId);
      
      const { data, error } = await supabase
        .from("software")
        .select(`
          *,
          department:departments(id, name)
        `)
        .in("team_id", teamMemberIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setSoftwareData(data || []);
      setFilteredData(data || []);
    } catch (error) {
      console.error("Error fetching software data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;

      const teamMemberIds = await getTeamMemberIds(supabase, effectiveUserId);

      // Fetch departments
      const { data: departmentsData, error: departmentsError } = await supabase
        .from("departments")
        .select("id, name")
        .order("name", { ascending: true });

      if (departmentsError) {
        console.error("Error fetching departments:", departmentsError);
      } else {
        setDepartments(departmentsData || []);
      }
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
    }
  };

  const handleAddNew = () => {
    setCurrentSoftware(null);
    setFormData({
      software: "",
      url: "",
      description: "",
      price_monthly: null,
      pricing_period: 'monthly',
      department_id: null,
    });
    setDialogOpen(true);
  };

  const handleEdit = (software: SoftwareData) => {
    setCurrentSoftware(software);
    setFormData({
      software: software.software,
      url: software.url || "",
      description: software.description || "",
      price_monthly: software.price_monthly,
      pricing_period: software.pricing_period || 'monthly',
      department_id: software.department_id,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this software entry?")) {
      return;
    }

    try {
      setDeleteLoading(id);
      const { error } = await supabase
        .from("software")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      await fetchSoftwareData();
    } catch (error) {
      console.error("Error deleting software:", error);
      alert("Failed to delete software. Please try again.");
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) throw new Error("No effective user ID");

      const { data: adminBusinessInfo } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', effectiveUserId)
        .single();
      
      const teamId = adminBusinessInfo?.team_id || effectiveUserId;

      if (currentSoftware) {
        // Update existing software
        const { error } = await supabase
          .from("software")
          .update({
            software: formData.software,
            url: formData.url || null,
            description: formData.description || null,
            price_monthly: formData.price_monthly,
            pricing_period: formData.pricing_period || 'monthly',
            department_id: formData.department_id || null,
            updated_at: new Date().toISOString()
          })
          .eq("id", currentSoftware.id);
          
        if (error) throw error;
      } else {
        // Create new software
        const { error } = await supabase
          .from("software")
          .insert({
            team_id: teamId,
            software: formData.software,
            url: formData.url || null,
            description: formData.description || null,
            price_monthly: formData.price_monthly,
            pricing_period: formData.pricing_period || 'monthly',
            department_id: formData.department_id || null,
          });
          
        if (error) throw error;
      }
      
      await fetchSoftwareData();
      setDialogOpen(false);
    } catch (error) {
      console.error("Error saving software:", error);
      alert("Failed to save software. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const formatPrice = (price: number | null, period: 'monthly' | 'yearly' | 'custom' | 'n/a' | null = null): string => {
    if (price === null || period === 'n/a' || period === null) {
      if (period === 'custom') return "Pay as you go";
      if (period === 'n/a') return "N/A";
      return "—";
    }
    const formattedPrice = `£${price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (period === 'yearly') {
      return `${formattedPrice}/year`;
    }
    return `${formattedPrice}/month`;
  };

  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="md:text-3xl text-2xl font-medium text-gray-900">Software Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track software subscriptions and tools used across your departments
          </p>
        </div>
        <Button 
          onClick={handleAddNew}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Software
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : (
        <Card className=" border-gray-200">
          {softwareData.length > 0 ? (
            <div>
              {/* Search and filter bar */}
              <div className="p-4 bg-white border-b border-gray-100 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 max-w-md w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <ExpandableInput
                    placeholder="Search by software, description, URL..."
                    className="pl-10 pr-4 py-2 w-full border-gray-200 rounded-md"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    expandAfter={40}
                    lined={true}
                  />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <DepartmentFilterDropdown
                    value={activeDepartment}
                    onChange={setActiveDepartment}
                    departments={departments}
                    placeholder="All Departments"
                    className="w-full sm:w-[200px]"
                  />
                  <div className="flex items-center text-sm text-gray-500 whitespace-nowrap">
                    <Filter className="h-4 w-4 mr-1" />
                    {filteredData.length} of {softwareData.length} software
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow className="border-b border-gray-200 hover:bg-gray-50/50">
                      <TableHead className="w-[200px] py-3.5 text-sm font-semibold text-gray-700 px-6">Software</TableHead>
                      <TableHead className="w-[200px] py-3.5 text-sm font-semibold text-gray-700 px-6 border-l">URL</TableHead>
                      <TableHead className="w-[300px] py-3.5 text-sm font-semibold text-gray-700 px-6 border-l">Description</TableHead>
                      <TableHead className="w-[150px] py-3.5 text-sm font-semibold text-gray-700 px-6 border-l">Price</TableHead>
                      <TableHead className="w-[150px] py-3.5 text-sm font-semibold text-gray-700 px-6 border-l">Department</TableHead>
                      <TableHead className="w-[120px] py-3.5 text-sm font-semibold text-gray-700 px-6 border-l text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? (
                      filteredData.map((software) => (
                        <TableRow 
                          key={software.id} 
                          className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors"
                        >
                          <TableCell className="font-medium text-blue-700 py-4 px-6">{software.software || "—"}</TableCell>
                          <TableCell className="py-4 px-6 border-l">
                            {software.url ? (
                              <a 
                                href={software.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                              >
                                <span className="truncate max-w-[180px]">{software.url}</span>
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              </a>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="py-4 px-6 border-l text-gray-600">
                            <div className="max-w-[280px] truncate" title={software.description || ""}>
                              {software.description || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6 border-l font-medium">
                            {formatPrice(software.price_monthly, software.pricing_period)}
                          </TableCell>
                          <TableCell className="py-4 px-6 border-l">
                            {software.department ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {software.department.name}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="py-4 text-right px-6 border-l">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(software)}
                                className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
                                title="Edit software"
                              >
                                <Pencil className="h-4 w-4 text-gray-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(software.id)}
                                className="h-8 w-8 p-0 hover:bg-red-100 rounded-full"
                                disabled={deleteLoading === software.id}
                                title="Delete software"
                              >
                                {deleteLoading === software.id ? (
                                  <Loader2 className="h-4 w-4 text-red-500 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                          No software found. Try adjusting your filters or add new software.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="bg-blue-50 rounded-full p-3 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-blue-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No software tracked</h3>
              <p className="text-gray-500 mb-6 max-w-md">
                Get started by adding your first software subscription or tool.
              </p>
              <Button 
                onClick={handleAddNew}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Software
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {currentSoftware ? "Edit Software" : "Add Software"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="software" className="text-gray-800 font-medium">
                Software <span className="text-red-500">*</span>
              </Label>
              <Input
                id="software"
                value={formData.software}
                onChange={(e) => setFormData({ ...formData, software: e.target.value })}
                placeholder="e.g., Slack, Microsoft 365, Salesforce"
                className="rounded-xl border-gray-200 focus:border-gray-500 focus:ring-gray-500"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url" className="text-gray-800 font-medium">
                URL
              </Label>
              <Input
                id="url"
                type="url"
                value={formData.url || ""}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://example.com"
                className="rounded-xl border-gray-200 focus:border-gray-500 focus:ring-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-gray-800 font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the software and its purpose..."
                className="rounded-xl border-gray-200 focus:border-gray-500 focus:ring-gray-500 min-h-[100px]"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pricing_period" className="text-gray-800 font-medium">
                Pricing Period
              </Label>
              <Select
                value={formData.pricing_period || 'monthly'}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  pricing_period: value as 'monthly' | 'yearly' | 'custom' | 'n/a',
                  // Clear price if set to n/a or custom
                  price_monthly: (value === 'n/a' || value === 'custom') ? null : formData.price_monthly
                })}
              >
                <SelectTrigger className="rounded-xl border-gray-200 focus:border-gray-500 focus:ring-gray-500">
                  <SelectValue placeholder="Select pricing period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="custom">Custom (Pay as you go)</SelectItem>
                  <SelectItem value="n/a">N/A</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.pricing_period === 'monthly' || formData.pricing_period === 'yearly') && (
              <div className="space-y-2">
                <Label htmlFor="price_monthly" className="text-gray-800 font-medium">
                  Price ({formData.pricing_period === 'yearly' ? 'Yearly' : 'Monthly'} £)
                </Label>
                <Input
                  id="price_monthly"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_monthly ?? ""}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    price_monthly: e.target.value ? parseFloat(e.target.value) : null 
                  })}
                  placeholder="0.00"
                  className="rounded-xl border-gray-200 focus:border-gray-500 focus:ring-gray-500"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="department_id" className="text-gray-800 font-medium">
                Department
              </Label>
              <DepartmentDropdown
                value={formData.department_id || ""}
                onChange={(value) => setFormData({ ...formData, department_id: value || null })}
                departments={departments}
                placeholder="Select department"
                className="w-full"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !formData.software.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  currentSoftware ? "Update" : "Add Software"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


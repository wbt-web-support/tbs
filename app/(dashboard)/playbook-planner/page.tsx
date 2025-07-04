"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Pencil, Trash2, Search, Filter, ExternalLink } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamMemberIds } from "@/utils/supabase/teams";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PlaybookData = {
  id: string;
  user_id: string;
  playbookname: string;
  description: string;
  enginetype: "GROWTH" | "FULFILLMENT" | "INNOVATION";
  owner: string;
  status: "Backlog" | "In Progress" | "Behind" | "Completed";
  link: string;
  created_at: string;
  updated_at: string;
};

export default function GrowthEngineLibraryPage() {
  const [playbooksData, setPlaybooksData] = useState<PlaybookData[]>([]);
  const [filteredData, setFilteredData] = useState<PlaybookData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPlaybook, setCurrentPlaybook] = useState<PlaybookData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [activeEngineType, setActiveEngineType] = useState<string>("all");
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<Omit<PlaybookData, 'id' | 'user_id' | 'created_at' | 'updated_at'>>({
    playbookname: "",
    description: "",
    enginetype: "GROWTH",
    owner: "",
    status: "Backlog",
    link: ""
  });
  
  const supabase = createClient();

  useEffect(() => {
    fetchPlaybooksData();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === "" && activeEngineType === "all") {
      setFilteredData(playbooksData);
    } else {
      let filtered = playbooksData;
      
      // Filter by engine type if not "all"
      if (activeEngineType !== "all") {
        filtered = filtered.filter(playbook => 
          playbook.enginetype === activeEngineType
        );
      }
      
      // Filter by search term if provided
      if (searchTerm.trim() !== "") {
        const lowercasedSearch = searchTerm.toLowerCase();
        filtered = filtered.filter(playbook => 
          playbook.playbookname.toLowerCase().includes(lowercasedSearch) ||
          playbook.description.toLowerCase().includes(lowercasedSearch) ||
          playbook.owner.toLowerCase().includes(lowercasedSearch)
        );
      }
      
      setFilteredData(filtered);
    }
  }, [searchTerm, activeEngineType, playbooksData]);

  const fetchPlaybooksData = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No authenticated user");
      
      const teamMemberIds = await getTeamMemberIds(supabase, user.id);
      
      const { data, error } = await supabase
        .from("playbooks")
        .select("*")
        .in("user_id", teamMemberIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setPlaybooksData(data || []);
      setFilteredData(data || []);
    } catch (error) {
      console.error("Error fetching playbooks data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setCurrentPlaybook(null);
    setFormData({
      playbookname: "",
      description: "",
      enginetype: "GROWTH",
      owner: "",
      status: "Backlog",
      link: ""
    });
    setDialogOpen(true);
  };

  const handleEdit = (playbook: PlaybookData) => {
    setCurrentPlaybook(playbook);
    setFormData({
      playbookname: playbook.playbookname,
      description: playbook.description,
      enginetype: playbook.enginetype,
      owner: playbook.owner,
      status: playbook.status,
      link: playbook.link
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleteLoading(id);
      
      const { error } = await supabase
        .from("playbooks")
        .delete()
        .eq("id", id);
        
      if (error) throw error;
      
      await fetchPlaybooksData();
    } catch (error) {
      console.error("Error deleting playbook:", error);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleSavePlaybook = async () => {
    try {
      setIsSaving(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No authenticated user");

      if (currentPlaybook) {
        // Update existing playbook
        const { error } = await supabase
          .from("playbooks")
          .update({
            playbookname: formData.playbookname,
            description: formData.description,
            enginetype: formData.enginetype,
            owner: formData.owner,
            status: formData.status,
            link: formData.link
          })
          .eq("id", currentPlaybook.id);
          
        if (error) throw error;
      } else {
        // Create new playbook
        const { error } = await supabase
          .from("playbooks")
          .insert({
            user_id: user.id,
            playbookname: formData.playbookname,
            description: formData.description,
            enginetype: formData.enginetype,
            owner: formData.owner,
            status: formData.status,
            link: formData.link
          });
          
        if (error) throw error;
      }
      
      await fetchPlaybooksData();
      setDialogOpen(false);
    } catch (error) {
      console.error("Error saving playbook:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Backlog":
        return "bg-gray-100 text-gray-800";
      case "In Progress":
        return "bg-blue-100 text-blue-800";
      case "Behind":
        return "bg-red-100 text-red-800";
      case "Completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getEngineTypeColor = (type: string) => {
    switch (type) {
      case "GROWTH":
        return "bg-blue-100 text-blue-800";
      case "FULFILLMENT":
        return "bg-purple-100 text-purple-800";
      case "INNOVATION":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Growth Engine Library</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your business engine playbooks and documentation
          </p>
        </div>
        <Button 
          onClick={handleAddNew}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Playbook
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : (
        <Card className="overflow-hidden border-gray-200">
          <div className="p-4 bg-white border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, description, owner..."
                className="pl-10 pr-4 py-2 w-full border-gray-200 rounded-md"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Tabs 
              value={activeEngineType} 
              onValueChange={setActiveEngineType}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid grid-cols-4 w-full sm:w-auto">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="GROWTH" className="text-xs">Growth</TabsTrigger>
                <TabsTrigger value="FULFILLMENT" className="text-xs">Fulfillment</TabsTrigger>
                <TabsTrigger value="INNOVATION" className="text-xs">Innovation</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="flex items-center text-sm text-gray-500 ml-auto">
              <Filter className="h-4 w-4 mr-1" />
              {filteredData.length} of {playbooksData.length} playbooks
            </div>
          </div>

          {playbooksData.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No playbooks found</h3>
              <p className="text-gray-500 mb-6">Get started by adding your first playbook.</p>
              <Button
                onClick={handleAddNew}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Playbook
              </Button>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No matching playbooks</h3>
              <p className="text-gray-500">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow className="border-b border-gray-200 hover:bg-gray-50/50">
                    <TableHead className="w-[250px] py-3.5 text-sm font-semibold text-gray-700">Playbook Name</TableHead>
                    <TableHead className="w-[150px] py-3.5 text-sm font-semibold text-gray-700">Engine Type</TableHead>
                    <TableHead className="w-[150px] py-3.5 text-sm font-semibold text-gray-700">Owner</TableHead>
                    <TableHead className="w-[120px] py-3.5 text-sm font-semibold text-gray-700">Status</TableHead>
                    <TableHead className="w-[120px] py-3.5 text-sm font-semibold text-gray-700">Link</TableHead>
                    <TableHead className="w-[120px] py-3.5 text-sm font-semibold text-gray-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((playbook) => (
                    <TableRow 
                      key={playbook.id} 
                      className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors"
                    >
                      <TableCell className="font-medium text-blue-700 py-4">
                        <div>
                          <div className="font-medium text-blue-700">{playbook.playbookname}</div>
                          {playbook.description && (
                            <div className="text-xs text-gray-500 mt-1 line-clamp-1">{playbook.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={`px-2.5 py-1 rounded-full text-xs font-medium ${getEngineTypeColor(playbook.enginetype)}`}>
                          {playbook.enginetype}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">{playbook.owner || "—"}</TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(playbook.status)}`}>
                          {playbook.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        {playbook.link ? (
                          <a 
                            href={playbook.link.startsWith('http') ? playbook.link : `https://${playbook.link}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 flex items-center"
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            <span className="text-sm">Link</span>
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(playbook)}
                            className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
                            title="Edit playbook"
                          >
                            <Pencil className="h-4 w-4 text-gray-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(playbook.id)}
                            className="h-8 w-8 p-0 hover:bg-red-100 rounded-full"
                            title="Delete playbook"
                            disabled={deleteLoading === playbook.id}
                          >
                            {deleteLoading === playbook.id ? (
                              <Loader2 className="h-4 w-4 text-red-600 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-600" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {/* Add/Edit Playbook Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{currentPlaybook ? "Edit Playbook" : "Add New Playbook"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="playbookName">Playbook Name*</Label>
              <Input
                id="playbookName"
                value={formData.playbookname}
                onChange={(e) => setFormData({ ...formData, playbookname: e.target.value })}
                placeholder="Enter playbook name"
                className="w-full"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
                className="min-h-[80px] w-full"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="engineType">Engine Type*</Label>
                <Select
                  value={formData.enginetype}
                  onValueChange={(value) => setFormData({ ...formData, enginetype: value as PlaybookData["enginetype"] })}
                >
                  <SelectTrigger id="engineType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GROWTH">GROWTH</SelectItem>
                    <SelectItem value="FULFILLMENT">FULFILLMENT</SelectItem>
                    <SelectItem value="INNOVATION">INNOVATION</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="status">Status*</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as PlaybookData["status"] })}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Backlog">Backlog</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Behind">Behind</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="owner">Owner</Label>
              <Input
                id="owner"
                value={formData.owner}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                placeholder="Enter owner name"
                className="w-full"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="link">Link</Label>
              <Input
                id="link"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                placeholder="Enter link to documentation/resource"
                className="w-full"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3">
            <Button 
              variant="outline" 
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSavePlaybook}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isSaving || !formData.playbookname.trim()}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {currentPlaybook ? "Update Playbook" : "Create Playbook"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
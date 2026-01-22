"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Settings2, Search, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface GlobalService {
  id: string;
  service_name: string;
  category: string;
  description: string;
}

interface GlobalServiceAssignmentProps {
  userId: string; // This is the auth.users.id
}

export function GlobalServiceAssignment({ userId }: GlobalServiceAssignmentProps) {
  const [services, setServices] = useState<GlobalService[]>([]);
  const [assignedServiceIds, setAssignedServiceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch all active global services
      const { data: allServices, error: servicesError } = await supabase
        .from("global_services")
        .select("id, service_name, category, description")
        .eq("is_active", true)
        .order("service_name");

      if (servicesError) throw servicesError;

      // Fetch currently assigned services for this user
      const { data: assignedServices, error: assignedError } = await supabase
        .from("team_services")
        .select("service_id")
        .eq("team_id", userId);

      if (assignedError) throw assignedError;

      setServices(allServices || []);
      setAssignedServiceIds(assignedServices?.map((s: { service_id: any; }) => s.service_id) || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleService = (serviceId: string) => {
    setAssignedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleAddService = async () => {
    if (!newServiceName.trim()) return;

    try {
      setAddingNew(true);
      
      // Check if service already exists
      const { data: existing } = await supabase
        .from("global_services")
        .select("id")
        .eq("service_name", newServiceName.trim())
        .single();

      if (existing) {
        toast.error("Service already exists");
        return;
      }

      const { data: newService, error } = await supabase
        .from("global_services")
        .insert({
          service_name: newServiceName.trim(),
          category: "General",
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("New service created");
      setNewServiceName("");
      await fetchData();
      
      // Automatically select the new service
      if (newService) {
        setAssignedServiceIds(prev => [...prev, newService.id]);
      }
    } catch (error) {
      console.error("Error adding service:", error);
      toast.error("Failed to create service");
    } finally {
      setAddingNew(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      setDeletingId(serviceId);
      const { error } = await supabase
        .from("global_services")
        .delete()
        .eq("id", serviceId);

      if (error) throw error;

      toast.success("Service deleted permanently");
      setServices(prev => prev.filter(s => s.id !== serviceId));
      setAssignedServiceIds(prev => prev.filter(id => id !== serviceId));
    } catch (error) {
      console.error("Error deleting service:", error);
      toast.error("Failed to delete service");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Get current assignments to determine what to add and what to remove
      const { data: currentAssigned, error: fetchError } = await supabase
        .from("team_services")
        .select("service_id")
        .eq("team_id", userId);

      if (fetchError) throw fetchError;

      const currentIds = currentAssigned?.map((s: { service_id: any; }) => s.service_id) || [];
      
      const toAdd = assignedServiceIds.filter(id => !currentIds.includes(id));
      const toRemove = currentIds.filter((id: string) => !assignedServiceIds.includes(id));

      // Remove unselected
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("team_services")
          .delete()
          .eq("team_id", userId)
          .in("service_id", toRemove);
        
        if (removeError) throw removeError;
      }

      // Add newly selected
      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from("team_services")
          .insert(toAdd.map(serviceId => ({
            team_id: userId,
            service_id: serviceId
          })));
        
        if (addError) throw addError;
      }

      toast.success("Services updated successfully");
      await fetchData(); // Refresh data
    } catch (error) {
      console.error("Error saving services:", error);
      toast.error("Failed to save services");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </Card>
    );
  }

  const filteredServices = services.filter(s => 
    s.service_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.category && s.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Card className="p-6">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Services
          </h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {assignedServiceIds.length} Selected
            </Badge>
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search services..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-1">
            <Input
              placeholder="Add new service..."
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddService();
                }
              }}
            />
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleAddService} 
              disabled={addingNew || !newServiceName.trim()}
              title="Add New Global Service"
            >
              {addingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {filteredServices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer hover:border-blue-200 ${
                    assignedServiceIds.includes(service.id)
                      ? "bg-blue-50/50 border-blue-200"
                      : "hover:bg-slate-50"
                  }`}
                  onClick={() => handleToggleService(service.id)}
                >
                  <Checkbox
                    id={service.id}
                    checked={assignedServiceIds.includes(service.id)}
                    onCheckedChange={() => handleToggleService(service.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={service.id}
                          className="text-sm font-semibold leading-none cursor-pointer"
                        >
                          {service.service_name}
                        </label>
                        {service.category && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal opacity-70">
                            {service.category}
                          </Badge>
                        )}
                      </div>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {deletingId === service.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Global Service?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete <strong>{service.service_name}</strong> from the system. 
                              It will be removed from all users and machines. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteService(service.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete Permanently
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    {service.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {service.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No services match your search." : "No active services available."}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

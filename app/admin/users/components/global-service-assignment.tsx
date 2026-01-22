"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Settings2, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

  const categories = Array.from(new Set(filteredServices.map((s) => s.category || "General")));

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

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search services or categories..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
          {categories.length > 0 ? (
            categories.map((category) => (
              <div key={category} className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider sticky top-0 bg-white py-1">
                  {category}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredServices
                    .filter((s) => (s.category || "General") === category)
                    .map((service) => (
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
                          <label
                            htmlFor={service.id}
                            className="text-sm font-semibold leading-none cursor-pointer"
                          >
                            {service.service_name}
                          </label>
                          {service.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {service.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))
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

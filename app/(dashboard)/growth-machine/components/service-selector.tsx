"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, X, Check, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

type Service = {
  id: string;
  service_name: string;
  description?: string;
  category?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

interface ServiceSelectorProps {
  engineType: "GROWTH" | "FULFILLMENT";
  onServicesSelected: (serviceIds: string[]) => void;
  welcomeCompleted?: boolean;
  onWelcomeComplete?: () => void;
}

export default function ServiceSelector({
  engineType,
  onServicesSelected,
  welcomeCompleted = false,
  onWelcomeComplete,
}: ServiceSelectorProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [newServiceName, setNewServiceName] = useState("");
  const [isAddingService, setIsAddingService] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isContinuing, setIsContinuing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(!welcomeCompleted);
  const [showServiceSelection, setShowServiceSelection] = useState(false);
  const supabase = createClient();

  const engineName = engineType === "GROWTH" ? "Growth" : "Fulfillment";
  const engineColor = engineType === "GROWTH" ? "blue" : "purple";

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const teamId = await getTeamId(supabase, user.id);
      if (!teamId) throw new Error("Team ID not found");

      // Fetch all available services
      const response = await fetch("/api/services?type=all");
      if (!response.ok) throw new Error("Failed to fetch services");

      const { services: allServices, selectedServiceIds } = await response.json();
      setServices(allServices || []);
      
      // Pre-select services that team already has
      if (selectedServiceIds && selectedServiceIds.length > 0) {
        setSelectedServices(selectedServiceIds);
      }
    } catch (error: any) {
      console.error("Error fetching services:", error);
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = async () => {
    if (!newServiceName.trim()) {
      toast.error("Please enter a service name");
      return;
    }

    try {
      setIsAddingService(true);
      const response = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_name: newServiceName.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add service");
      }

      const { service } = await response.json();
      // Refresh services list to get the new one
      await fetchServices();
      // Add to selected
      if (service && service.id) {
        setSelectedServices([...selectedServices, service.id]);
      }
      setNewServiceName("");
      toast.success("Service added successfully");
    } catch (error: any) {
      console.error("Error adding service:", error);
      toast.error(error.message || "Failed to add service");
    } finally {
      setIsAddingService(false);
    }
  };

  const handleToggleService = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleContinue = async () => {
    if (selectedServices.length === 0) {
      toast.error("Please select at least one service");
      return;
    }

    try {
      setIsContinuing(true);
      // Add selected services to team
      const promises = selectedServices.map((serviceId) =>
        fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service_id: serviceId }),
        })
      );

      await Promise.all(promises);
      onServicesSelected(selectedServices);
    } catch (error: any) {
      console.error("Error saving services:", error);
      toast.error("Failed to save service selections");
    } finally {
      setIsContinuing(false);
    }
  };

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
    setShowServiceSelection(true);
    if (onWelcomeComplete) {
      onWelcomeComplete();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-500px)] py-8">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (showWelcome) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-500px)] py-8">
        <Card className="border border-gray-200 max-w-3xl w-full mx-auto bg-gray-50">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  Welcome to Growth Engine
                </h3>
                <p className="text-base text-gray-600 leading-relaxed max-w-2xl mx-auto">
                  This is Growth Engine - here you can define and manage your growth machine process. 
                  We've analysed your company data and our AI assistant can help map your growth process. 
                  Let's get started!
                </p>
              </div>
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleWelcomeComplete}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-md px-8 py-6 text-base"
                  size="lg"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Let AI Help You Create This
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!showServiceSelection && !showWelcome) {
    // If welcome is completed but we haven't shown service selection yet, show it
    setShowServiceSelection(true);
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-500px)] py-8">
      <Card className="border border-gray-200 max-w-3xl w-full mx-auto bg-gray-50">
        <CardHeader className="pb-6">
          <CardTitle className="text-2xl font-semibold text-gray-900">
            Select Your Services
          </CardTitle>
          <CardDescription className="text-gray-600 mt-2">
            Choose which services you want to create growth machines for. 
            You can add new services or select existing ones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Available Services */}
          {services.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Available Services</h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition"
                  >
                    <Checkbox
                      checked={selectedServices.includes(service.id)}
                      onCheckedChange={() => handleToggleService(service.id)}
                    />
                    <label className="flex-1 text-sm font-medium text-gray-900 cursor-pointer">
                      {service.service_name}
                      {service.category && (
                        <span className="ml-2 text-xs text-gray-500">({service.category})</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Service */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700">Add New Service</h4>
            <div className="flex space-x-2">
              <Input
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="Enter service name (e.g., Plumbing, Electrical)"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddService();
                  }
                }}
              />
              <Button
                onClick={handleAddService}
                disabled={isAddingService || !newServiceName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isAddingService ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Continue Button */}
          <div className="flex justify-end pt-6 border-t border-gray-200">
            <Button
              onClick={handleContinue}
              disabled={selectedServices.length === 0 || isContinuing}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              {isContinuing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating machines...
                </>
              ) : (
                <>
                  Continue
                  <Check className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

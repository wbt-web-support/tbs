"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/utils/supabase/client";
import MachinePlanner from "./machine-planner";
import MachineDesign from "./machine-design";
import { Settings, Image as ImageIcon } from "lucide-react";

type Service = {
  id: string;
  service_name: string;
  description?: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
};

interface ServiceTabsProps {
  serviceIds: string[];
  engineType: "GROWTH" | "FULFILLMENT";
  onDataChange?: () => void;
}

export default function ServiceTabs({
  serviceIds,
  engineType,
  onDataChange,
}: ServiceTabsProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"planner" | "design">("planner");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchServices();
  }, [serviceIds]);

  useEffect(() => {
    if (services.length > 0 && !activeServiceId) {
      setActiveServiceId(services[0].id);
    }
  }, [services, activeServiceId]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      // Fetch team's selected services
      const response = await fetch("/api/services?type=team");
      if (!response.ok) throw new Error("Failed to fetch services");

      const { services: fetchedServices } = await response.json();
      // Filter to only show selected services
      const filteredServices = (fetchedServices || []).filter((s: Service) =>
        serviceIds.includes(s.id)
      );
      setServices(filteredServices);
      
      if (filteredServices.length > 0 && !activeServiceId) {
        setActiveServiceId(filteredServices[0].id);
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading services...</div>;
  }

  if (services.length === 0) {
    return <div>No services selected</div>;
  }

  return (
    <div className="w-full flex flex-col h-full">
      {/* Service Tabs - Top Level with Improved Design */}
      <div className="mb-6 px-6 pt-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
          <Tabs
            value={activeServiceId || undefined}
            onValueChange={(value) => setActiveServiceId(value)}
            className="w-full"
          >
            <TabsList className="inline-flex h-auto w-full bg-transparent p-0 gap-2 overflow-x-auto">
              {services.map((service) => (
                <TabsTrigger
                  key={service.id}
                  value={service.id}
                  className="relative px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap
                    text-gray-600 hover:text-gray-900 hover:bg-gray-50
                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 
                    data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-blue-200
                    data-[state=active]:hover:from-blue-600 data-[state=active]:hover:to-blue-700"
                >
                  {service.service_name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Planner/Design Tabs - Per Service with Improved Design */}
      {activeServiceId && (
        <div className="flex-1 flex flex-col min-h-0 px-6">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "planner" | "design")}
            className="w-full flex-1 flex flex-col"
          >
            <div className="flex items-center justify-between mb-5">
              <TabsList className="inline-flex h-11 items-center justify-center rounded-lg bg-gray-100 p-1 text-gray-500">
                <TabsTrigger 
                  value="planner" 
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all
                    hover:text-gray-900
                    data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Planner
                </TabsTrigger>
                <TabsTrigger 
                  value="design" 
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all
                    hover:text-gray-900
                    data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Design
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="planner" className="flex-1 mt-0 min-h-0">
              <MachinePlanner
                serviceId={activeServiceId}
                engineType={engineType}
                onDataChange={onDataChange}
                isPlannerTabActive={activeTab === "planner" && activeServiceId !== null}
              />
            </TabsContent>

            <TabsContent value="design" className="flex-1 mt-0 min-h-0">
              <MachineDesign
                serviceId={activeServiceId}
                engineType={engineType}
                onDataChange={onDataChange}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

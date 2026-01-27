"use client";

import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/utils/supabase/client";
import MachinePlanner from "./machine-planner";
import MachineDesign from "./machine-design";
import { Settings, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Subcategory = {
  id: string;
  subcategory_name: string;
  description?: string;
  service_id: string;
  global_services?: {
    service_name: string;
  };
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
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"planner" | "design">("planner");
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchSubcategories();
  }, [serviceIds]);

  useEffect(() => {
    if (subcategories.length > 0 && !activeSubcategoryId) {
      setActiveSubcategoryId(subcategories[0].id);
    }
    checkScrollability();
  }, [subcategories, activeSubcategoryId]);

  const checkScrollability = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 10
      );
    }
  };

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = 300;
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
      setTimeout(checkScrollability, 300);
    }
  };

  const fetchSubcategories = async () => {
    try {
      setLoading(true);
      // Fetch all subcategories for the team
      const response = await fetch("/api/subcategories");
      if (!response.ok) throw new Error("Failed to fetch subcategories");

      const { subcategories: fetchedSubcategories } = await response.json();
      // Filter to only show subcategories for selected services
      const filteredSubcategories = (fetchedSubcategories || []).filter(
        (subcat: Subcategory) => serviceIds.includes(subcat.service_id)
      );
      setSubcategories(filteredSubcategories);
      
      if (filteredSubcategories.length > 0 && !activeSubcategoryId) {
        setActiveSubcategoryId(filteredSubcategories[0].id);
      }
    } catch (error) {
      console.error("Error fetching subcategories:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading machines...</div>;
  }

  if (subcategories.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-600 mb-2">No machines found</p>
          <p className="text-sm text-gray-500">
            Please complete the service details collection and machine creation steps.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col h-full">
      {/* Machine Tabs - Top Level */}
      <div className="mb-6 px-6 pt-6">
        <div className="relative bg-white rounded-lg border border-gray-200">
          {/* Left Scroll Arrow */}
          {canScrollLeft && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 p-0 bg-white/90 hover:bg-white shadow-md border border-gray-200"
            >
              <ChevronLeft className="h-5 w-5 text-gray-700" />
            </Button>
          )}

          {/* Right Scroll Arrow */}
          {canScrollRight && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 p-0 bg-white/90 hover:bg-white shadow-md border border-gray-200"
            >
              <ChevronRight className="h-5 w-5 text-gray-700" />
            </Button>
          )}

          <Tabs
            value={activeSubcategoryId || undefined}
            onValueChange={(value) => setActiveSubcategoryId(value)}
            className="w-full"
          >
            <div
              ref={scrollContainerRef}
              onScroll={checkScrollability}
              className="overflow-x-auto scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <TabsList className="inline-flex h-auto w-max bg-transparent p-2 gap-2">
                {subcategories.map((subcategory) => (
                  <TabsTrigger
                    key={subcategory.id}
                    value={subcategory.id}
                    className="relative px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap
                      text-gray-600 hover:text-gray-900 hover:bg-gray-50
                      data-[state=active]:bg-blue-600 
                      data-[state=active]:text-white
                      data-[state=active]:hover:bg-blue-700"
                  >
                    {subcategory.subcategory_name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Planner/Design Tabs - Per Subcategory */}
      {activeSubcategoryId && (
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
                subcategoryId={activeSubcategoryId}
                engineType={engineType}
                onDataChange={onDataChange}
                isPlannerTabActive={activeTab === "planner" && activeSubcategoryId !== null}
              />
            </TabsContent>

            <TabsContent value="design" className="flex-1 mt-0 min-h-0">
              <MachineDesign
                subcategoryId={activeSubcategoryId}
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

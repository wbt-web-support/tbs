"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TimelineView from "./components/timeline-view";
import BuildChecklist from "./components/build-checklist";
import AdditionalBenefits from "./components/additional-benefits";
import ContactInfo from "./components/contact-info";
import CourseProgress from "./components/course-progress";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type TimelineEvent = {
  id: string;
  week_number: number;
  event_name: string;
  scheduled_date: string;
  duration_minutes: number | null;
  description: string | null;
  is_completed?: boolean;
  completion_date?: string;
};

export default function ChqTimelinePage() {
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("timeline");
  const supabase = createClient();

  useEffect(() => {
    fetchTimelineEvents();
  }, []);

  const fetchTimelineEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("chq_timeline")
        .select("*")
        .order("week_number", { ascending: true });

      if (error) throw error;
      setTimelineEvents(data || []);
    } catch (error) {
      console.error("Error fetching timeline events:", error);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className={`flex-1 transition-all duration-300 ease-in-out ${
      activeTab === 'progress' ? 'p-0' : 'p-8'
    }`}>
      {/* Header - Hidden when Progress tab is active */}
      <div className={`transition-all duration-300 ease-in-out ${
        activeTab === 'progress' 
          ? 'opacity-0 -translate-y-4 h-0 overflow-hidden' 
          : 'opacity-100 translate-y-0 h-auto'
      }`}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Calendar</h1>
            <p className="text-sm text-gray-500 mt-1">
              Track your Command HQ implementation progress and milestones
            </p>
          </div>
        </div>
      </div>

      <Tabs 
        defaultValue="timeline" 
        value={activeTab}
        onValueChange={setActiveTab}
        className={`transition-all duration-300 ease-in-out ${
          activeTab === 'progress' ? 'h-screen' : 'space-y-4'
        }`}
      >
        <TabsList className={`bg-background border-b border-t rounded-none w-full justify-start h-10 p-0 gap-6 transition-all duration-300 ${
          activeTab === 'progress' 
            ? 'sticky top-0 z-10 bg-white shadow-sm px-8' 
            : ''
        }`}>
          <TabsTrigger 
            value="timeline" 
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-10"
          >
            Timeline
          </TabsTrigger>
          <TabsTrigger 
            value="checklist"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-10"
          >
            Build Checklist
          </TabsTrigger>
          <TabsTrigger 
            value="benefits"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-10"
          >
            Benefits
          </TabsTrigger>
          <TabsTrigger 
            value="progress"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-10"
          >
            Progress
          </TabsTrigger>
          {/* <TabsTrigger 
            value="contact"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-10"
          >
            Contact Info
          </TabsTrigger> */}
        </TabsList>

        <TabsContent 
          value="timeline" 
          className={`transition-all duration-300 ${
            activeTab === 'progress' ? 'hidden' : 'space-y-4'
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : (
            <TimelineView />
          )}
        </TabsContent>

        <TabsContent 
          value="checklist" 
          className={`transition-all duration-300 ${
            activeTab === 'progress' ? 'hidden' : 'space-y-4'
          }`}
        >
          <BuildChecklist />
        </TabsContent>

        <TabsContent 
          value="benefits" 
          className={`transition-all duration-300 ${
            activeTab === 'progress' ? 'hidden' : 'space-y-4'
          }`}
        >
          <AdditionalBenefits />
        </TabsContent>

        <TabsContent 
          value="progress" 
          className={`transition-all duration-300 ${
            activeTab === 'progress' 
              ? 'h-full flex-1' 
              : 'space-y-4'
          }`}
        >
          <CourseProgress />
        </TabsContent>

        <TabsContent 
          value="contact" 
          className={`transition-all duration-300 ${
            activeTab === 'progress' ? 'hidden' : 'space-y-4'
          }`}
        >
          <ContactInfo />
        </TabsContent>
      </Tabs>
    </div>
  );
} 
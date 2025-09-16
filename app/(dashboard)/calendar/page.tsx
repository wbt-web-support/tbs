"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TimelineView from "./components/timeline-view";
import TodoList from "./components/additional-benefits";
import ContactInfo from "./components/contact-info";
import { createClient } from "@/utils/supabase/client";
import MeetingRhythmPlanner from "./components/meeting-rhythm-planner";


type TimelineEvent = {
  id: string;
  week_number: number;
  event_name: string;
  scheduled_date: string;
  duration_minutes: number | null;
  description: string | null;
  is_completed?: boolean;
  completion_date?: string | null;
};

type TodoItem = {
  id: string;
  benefit_name: string;
  notes: string | null;
  iframe: string | null;
  is_disabled_for_team: boolean;
};

type TimelineData = {
  id: string;
  week_number: number;
  event_name: string;
  scheduled_date: string;
  duration_minutes: number | null;
  description: string | null;
};

type UserClaim = {
  timeline_id: string;
  is_completed: boolean;
  completion_date: string | null;
};

type Benefit = {
  id: string;
  benefit_name: string;
  notes: string | null;
  iframe: string | null;
  created_at: string;
};

type TeamStatus = {
  benefit_id: string;
};

export default function ChqTimelinePage() {
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [todoLoading, setTodoLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("calendar");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [hasTimelineEvents, setHasTimelineEvents] = useState<boolean | null>(null);
  const [dataFetched, setDataFetched] = useState({
    timeline: false,
    todos: false,
    contact: false
  });
  const supabase = createClient();

  useEffect(() => {
    checkTimelineExists();
  }, []);

  const checkTimelineExists = async () => {
    try {
      const { count, error } = await supabase
        .from("chq_timeline")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      setHasTimelineEvents((count || 0) > 0);
    } catch (error) {
      console.error("Error checking timeline events:", error);
      setHasTimelineEvents(false);
    }
  };

  // Fetch data based on active tab to implement lazy loading
  useEffect(() => {
    switch (activeTab) {
      case "timeline":
        if (!dataFetched.timeline) {
          fetchTimelineEvents();
        }
        break;
      case "benefits":
        if (!dataFetched.todos) {
          fetchTodoItems();
        }
        break;
      // We can add other cases for contact tab if needed
    }
  }, [activeTab, dataFetched]);

  const fetchTimelineEvents = async () => {
    if (dataFetched.timeline) return; // Prevent refetching

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Get timeline events
      const { data: timelineData, error: timelineError } = await supabase
        .from("chq_timeline")
        .select("*")
        .order("week_number", { ascending: true });

      if (timelineError) throw timelineError;

      // Get user's timeline claims
      const { data: userClaims, error: claimsError } = await supabase
        .from('user_timeline_claims')
        .select('*')
        .eq('user_id', user.id);

      if (claimsError) throw claimsError;

      // Combine timeline data with user claims
      const eventsWithClaims = timelineData?.map((event: TimelineData) => {
        const claim = userClaims?.find((claim: UserClaim) => claim.timeline_id === event.id);
        return {
          ...event,
          is_completed: claim?.is_completed || false,
          completion_date: claim?.completion_date || null
        };
      }) || [];

      setTimelineEvents(eventsWithClaims);
      setDataFetched(prev => ({ ...prev, timeline: true }));
    } catch (error) {
      console.error("Error fetching timeline events:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodoItems = async () => {
    if (dataFetched.todos) return; // Prevent refetching

    setTodoLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Get user's team information
      const { data: userInfo, error: userError } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', user.id)
        .single();

      if (userError) throw userError;
      
      const currentTeamId = userInfo?.team_id;
      setTeamId(currentTeamId);

      // Get all benefits
      const { data: allBenefits, error: benefitsError } = await supabase
        .from('chq_benefits')
        .select('*')
        .order('created_at', { ascending: false });

      if (benefitsError) throw benefitsError;

      // Get team benefit statuses if team exists
      let disabledBenefits: string[] = [];
      if (currentTeamId) {
        const { data: teamStatuses, error: statusError } = await supabase
          .from('team_benefit_status')
          .select('benefit_id')
          .eq('team_id', currentTeamId)
          .eq('is_disabled', true);

        if (statusError) throw statusError;
        disabledBenefits = teamStatuses?.map((status: TeamStatus) => status.benefit_id) || [];
      }

      // Combine data and filter out disabled benefits
      const todoItemsWithStatus = allBenefits
        .filter((benefit: Benefit) => !disabledBenefits.includes(benefit.id))
        .map((benefit: Benefit) => ({
          ...benefit,
          is_disabled_for_team: false
        }));

      setTodoItems(todoItemsWithStatus);
      setDataFetched(prev => ({ ...prev, todos: true }));
    } catch (error) {
      console.error('Error fetching todo items:', error);
    } finally {
      setTodoLoading(false);
    }
  };

  const handleTimelineEventUpdate = (updatedEvent: TimelineEvent) => {
    setTimelineEvents(prevEvents => 
      prevEvents.map(event => 
        event.id === updatedEvent.id ? updatedEvent : event
      )
    );
  };

  return (
    <div className="flex-1 transition-all duration-300 ease-in-out p-2 sm:p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="transition-all duration-300 ease-in-out opacity-100 translate-y-0 h-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">Calendar</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Track your Command HQ implementation progress and milestones
            </p>
          </div>
        </div>
      </div>

      <Tabs 
        defaultValue="calendar" 
        value={activeTab}
        onValueChange={setActiveTab}
        className="transition-all duration-300 ease-in-out space-y-2 sm:space-y-4"
      >
        <TabsList className="bg-background border-b border-t rounded-none w-full justify-start h-10 p-0 gap-2 sm:gap-6 transition-all duration-300 overflow-x-auto">
          <TabsTrigger 
            value="calendar" 
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-10 text-xs sm:text-sm whitespace-nowrap"
          >
            Calendar
          </TabsTrigger>
          <TabsTrigger 
            value="timeline" 
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-10 text-xs sm:text-sm whitespace-nowrap"
          >
            Timeline
          </TabsTrigger>
          <TabsTrigger 
            value="benefits"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-10 text-xs sm:text-sm whitespace-nowrap"
          >
            Book a Call
          </TabsTrigger>
        </TabsList>

        {/* All content is always mounted, just hidden with CSS */}
        <div className="relative">
          {/* Calendar Tab */}
          <div 
            className={`${activeTab === 'calendar' ? 'block' : 'hidden'} space-y-2 sm:space-y-4`}
          >
            <MeetingRhythmPlanner />
          </div>

          {/* Timeline Tab */}
          <div 
            className={`${activeTab === 'timeline' ? 'block' : 'hidden'} space-y-2 sm:space-y-4`}
          >
            <TimelineView 
              events={timelineEvents}
              loading={loading}
              onEventUpdate={handleTimelineEventUpdate}
            />
          </div>

          {/* Todo List Tab */}
          <div 
            className={`${activeTab === 'benefits' ? 'block' : 'hidden'} space-y-2 sm:space-y-4`}
          >
            <TodoList 
              todoItems={todoItems}
              loading={todoLoading}
              teamId={teamId}
            />
          </div>

          {/* Contact Tab */}
          <div 
            className={`${activeTab === 'contact' ? 'block' : 'hidden'} space-y-2 sm:space-y-4`}
          >
            <ContactInfo />
          </div>
        </div>
      </Tabs>
    </div>
  );
} 
"use client";

import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, Loader2, CalendarClock, Clock, Info } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type TimelineEvent = {
  id: string;
  week_number: number;
  event_name: string;
  scheduled_date: string;
  duration_minutes?: number;
  description?: string;
  is_completed?: boolean;
  completion_date?: string | null;
};

export default function TimelineView() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // First get all timeline events from the main table
      const { data: timelineEvents, error: eventsError } = await supabase
        .from('chq_timeline')
        .select(`
          id,
          week_number,
          event_name,
          scheduled_date,
          duration_minutes,
          description
        `)
        .order('week_number', { ascending: true });

      if (eventsError) throw eventsError;

      // Then get user's claims
      const { data: userClaims, error: claimsError } = await supabase
        .from('user_timeline_claims')
        .select('*')
        .eq('user_id', user.id);

      if (claimsError) throw claimsError;

      // Combine the data
      const eventsWithClaims = timelineEvents.map(event => {
        const claim = userClaims?.find(claim => claim.timeline_id === event.id);
        return {
          ...event,
          is_completed: claim?.is_completed || false,
          completion_date: claim?.completion_date || null
        };
      });

      setEvents(eventsWithClaims);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load timeline events');
    } finally {
      setLoading(false);
    }
  };

  const toggleCompletion = async (event: TimelineEvent) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      setUpdating(event.id);
      const isCompleted = !event.is_completed;

      // Check if claim already exists
      const { data: existingClaim } = await supabase
        .from('user_timeline_claims')
        .select('id')
        .eq('user_id', user.id)
        .eq('timeline_id', event.id)
        .single();

      if (existingClaim) {
        // Update existing claim
        const { error } = await supabase
          .from('user_timeline_claims')
          .update({
            is_completed: isCompleted,
            completion_date: isCompleted ? new Date().toISOString() : null
          })
          .eq('id', existingClaim.id);

        if (error) throw error;
      } else {
        // Create new claim
        const { error } = await supabase
          .from('user_timeline_claims')
          .insert([{
            user_id: user.id,
            timeline_id: event.id,
            is_completed: isCompleted,
            completion_date: isCompleted ? new Date().toISOString() : null
          }]);

        if (error) throw error;
      }

      // Update local state
      setEvents(currentEvents => 
        currentEvents.map(e => 
          e.id === event.id 
            ? { ...e, is_completed: isCompleted, completion_date: isCompleted ? new Date().toISOString() : null }
            : e
        )
      );

      toast.success(isCompleted ? 'Event marked as complete' : 'Event marked as incomplete');
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event status');
    } finally {
      setUpdating(null);
    }
  };

  const completedCount = events.filter(event => event.is_completed).length;
  const totalCount = events.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Group events by week
  const eventsByWeek: Record<number, TimelineEvent[]> = {};
  events.forEach(event => {
    if (!eventsByWeek[event.week_number]) {
      eventsByWeek[event.week_number] = [];
    }
    eventsByWeek[event.week_number].push(event);
  });

  // Sort weeks by number
  const weekNumbers = Object.keys(eventsByWeek).map(Number).sort((a, b) => a - b);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex-grow">
          <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-500" 
              style={{ width: `${progressPercentage}%` }} 
            />
          </div>
          <div className="flex justify-between mt-1 text-sm">
            <span className="text-muted-foreground">{completedCount} of {totalCount} events completed</span>
            <span className="font-medium text-blue-700">{Math.round(progressPercentage)}%</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {weekNumbers.map((weekNumber) => (
          <div key={weekNumber} className="space-y-2">
        
            <div className="space-y-2">
              {eventsByWeek[weekNumber].map((event) => (
                <Card 
                  key={event.id} 
                  className={`p-3 border border-blue-200 hover:border-blue-300 transition-all ${
                    event.is_completed 
                      ? "bg-blue-50/50" 
                      : ""
                  }`}
                >
                  <div className="flex items-center">
                    <div className="flex items-center gap-3 flex-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`p-1 mt-0.5 rounded-full bg-blue-100 text-blue-600 ${
                          event.is_completed 
                            ? "bg-blue-200" 
                            : ""
                        }`}
                        onClick={() => toggleCompletion(event)}
                        disabled={!!updating}
                      >
                        {updating === event.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : event.is_completed ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </Button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                            Week{weekNumber}
                          </span>
                          <h4 className="font-medium text-sm">{event.event_name}</h4>
                        </div>
                        
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" />
                            <span>{new Date(event.scheduled_date).toLocaleDateString()}</span>
                          </div>
                          
                          {event.duration_minutes && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{event.duration_minutes} min</span>
                            </div>
                          )}
                          
                          {event.completion_date && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Completed {new Date(event.completion_date).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {event.description && (
                      <div className="ml-4 px-3 py-2 text-xs text-muted-foreground max-w-[240px]">
                        <p>{event.description}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 
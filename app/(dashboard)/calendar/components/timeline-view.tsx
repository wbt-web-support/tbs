"use client";

import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, Loader2, CalendarClock, Clock, Info } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trackActivity } from "@/utils/points";

type TimelineEvent = {
  id: string;
  week_number: number;
  event_name: string;
  scheduled_date: string;
  duration_minutes: number | null;
  description: string | null;
  meeting_link?: string | null;
  is_completed?: boolean;
  completion_date?: string | null;
};

interface TimelineViewProps {
  events: TimelineEvent[];
  loading: boolean;
  onEventUpdate: (updatedEvent: TimelineEvent) => void;
}

export default function TimelineView({ events, loading, onEventUpdate }: TimelineViewProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const supabase = createClient();

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

      // Update the parent component's state
      const updatedEvent = {
        ...event,
        is_completed: isCompleted,
        completion_date: isCompleted ? new Date().toISOString() : null
      };
      onEventUpdate(updatedEvent);

      // Track points for completion
      if (isCompleted) {
        try {
          await trackActivity.timelineCompletion(event.id);
        } catch (pointsError) {
          console.error('Error tracking points:', pointsError);
          // Don't fail the main operation if points tracking fails
        }
      }

      toast.success(isCompleted ? "Event marked as complete" : "Event marked as incomplete");
    } catch (error) {
      console.error("Error updating timeline event:", error);
      toast.error("Failed to update timeline event");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No timeline events found.</p>
      </div>
    );
  }

  // Group events by week
  const eventsByWeek = events.reduce((acc, event) => {
    const week = event.week_number;
    if (!acc[week]) {
      acc[week] = [];
    }
    acc[week].push(event);
    return acc;
  }, {} as Record<number, TimelineEvent[]>);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
        <h2 className="text-lg sm:text-xl font-semibold">Implementation Timeline</h2>
      </div>
      
      <div className="space-y-6 sm:space-y-8">
        {Object.entries(eventsByWeek)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([week, weekEvents]) => (
            <div key={week} className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-medium text-gray-800 border-b pb-2">
                Week {week}
              </h3>
              <div className="space-y-3">
                {weekEvents.map((event) => (
                  <Card key={event.id} className={`p-3 sm:p-4 transition-all duration-200 ${
                    event.is_completed 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                  }`}>
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="pt-1 flex-shrink-0">
                        <button
                          onClick={() => toggleCompletion(event)}
                          disabled={updating === event.id}
                          className={`p-1 rounded-full transition-colors ${
                            event.is_completed
                              ? 'text-green-600 hover:text-green-700'
                              : 'text-gray-400 hover:text-blue-600'
                          }`}
                        >
                          {updating === event.id ? (
                            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                          ) : event.is_completed ? (
                            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            <Circle className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </button>
                      </div>
                      
                      <div className="flex-grow min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <h4 className={`font-medium text-sm sm:text-base ${
                              event.is_completed ? 'text-green-800 line-through' : 'text-gray-900'
                            }`}>
                              {event.event_name}
                            </h4>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <CalendarClock className="w-3 h-3 sm:w-4 sm:h-4" />
                                {formatDate(event.scheduled_date)}
                              </span>
                              {event.duration_minutes && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                  {formatDuration(event.duration_minutes)}
                                </span>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-xs sm:text-sm text-gray-600 mt-2">
                                {event.description}
                              </p>
                            )}
                            {event.completion_date && (
                              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Completed on {formatDate(event.completion_date)}
                              </p>
                            )}
                          </div>
                          
                          {event.meeting_link && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(event.meeting_link!, '_blank')}
                              className="w-full sm:w-auto sm:ml-4 text-xs sm:text-sm"
                            >
                              Join Meeting
                            </Button>
                          )}
                        </div>
                      </div>
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
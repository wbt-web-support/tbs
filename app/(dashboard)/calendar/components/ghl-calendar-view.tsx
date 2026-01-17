"use client";

import { useState, useEffect } from "react";
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays, subDays } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar as CalendarIcon, 
  RefreshCw, 
  MapPin, 
  Clock, 
  ExternalLink,
  Phone,
  Mail,
  User
} from "lucide-react";
import CalendarView from "./calendar-view";

type GHLAppointment = {
  id: string;
  title: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  status: string;
  contactId?: string;
  contactName?: string;
  calendarId?: string;
  calendarName?: string;
  location?: string;
  notes?: string;
};

// Unified event type compatible with CalendarView
type UnifiedEvent = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  description?: string;
  location?: string;
  status?: string;
  event_link?: string;
  attendees?: any[];
};

export default function GHLCalendarView() {
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'week' | 'calendar'>('calendar');
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());
  
  const { toast } = useToast();

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      // Fetch a wide range to cover navigation
      const now = new Date();
      const startDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(); // -60 days
      const endDate = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString(); // +180 days

      const response = await fetch(`/api/ghls/appointments?startDate=${startDate}&endDate=${endDate}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }

      const data = await response.json();
      
      // Transform to UnifiedEvent format
      const mappedEvents: UnifiedEvent[] = (data.appointments || []).map((appt: GHLAppointment) => ({
        id: appt.id,
        title: appt.title || 'Untitled Meeting',
        start_time: appt.startTime,
        end_time: appt.endTime,
        all_day: false, // GHL appointments are usually time-blocked
        description: appt.notes,
        location: appt.location,
        status: appt.status,
        event_link: `https://app.gohighlevel.com/v2/location/${process.env.NEXT_PUBLIC_GHL_LOCATION_ID || ''}/contacts/detail/${appt.contactId}`,
        attendees: appt.contactName ? [{ name: appt.contactName, email: '' }] : []
      }));

      setEvents(mappedEvents);
    } catch (error) {
      console.error('Error fetching GHL appointments:', error);
      toast({
        title: "Error",
        description: "Failed to load GHL appointments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    await fetchAppointments();
    setSyncing(false);
    toast({
      title: "Synced",
      description: "Calendar updated from GoHighLevel",
    });
  };

  const getFilteredEvents = () => {
    return events.sort((a, b) => {
        const dateA = new Date(a.start_time);
        const dateB = new Date(b.start_time);
        return dateA.getTime() - dateB.getTime();
    });
  };

  const renderListView = () => {
    const sortedEvents = getFilteredEvents();
    const now = new Date();
    const upcomingEvents = sortedEvents.filter(e => new Date(e.end_time) >= now);
    const pastEvents = sortedEvents.filter(e => new Date(e.end_time) < now);

    return (
      <div className="space-y-4">
        {upcomingEvents.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Upcoming</h3>
            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <Card key={event.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900">{event.title}</h4>
                          <Badge variant="outline" className={`capitalize text-[10px] ${
                            event.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200' : 
                            event.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {event.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-2">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(parseISO(event.start_time), 'MMM d, yyyy h:mm a')} - {format(parseISO(event.end_time), 'h:mm a')}
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </div>
                          )}
                           {event.attendees && event.attendees.length > 0 && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {event.attendees[0].name}
                            </div>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{event.description}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {pastEvents.length > 0 && (
            <div className="pt-4">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">Past</h3>
              <div className="space-y-2">
                {pastEvents.slice(pastEvents.length - 5).reverse().map((event) => (
                  <Card key={event.id} className="border-l-4 border-l-gray-300 opacity-70">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-medium text-gray-600">{event.title}</h4>
                                <div className="text-xs text-gray-500 mt-1">
                                {format(parseISO(event.start_time), 'MMM d, yyyy h:mm a')}
                                </div>
                            </div>
                             <Badge variant="secondary" className="text-[10px] capitalize">{event.status}</Badge>
                        </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
        )}

        {sortedEvents.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No appointments found</p>
          </div>
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    // Reusing the logic from google-calendar-view, simplified for GHL
    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const sortedEvents = getFilteredEvents();

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedWeek(subDays(selectedWeek, 7))}>← Previous</Button>
            <span className="text-sm font-medium">{format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}</span>
            <Button variant="outline" size="sm" onClick={() => setSelectedWeek(addDays(selectedWeek, 7))}>Next →</Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSelectedWeek(new Date())}>Today</Button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dayEvents = sortedEvents.filter(e => isSameDay(new Date(e.start_time), day));
            return (
              <Card key={day.toISOString()} className="min-h-[150px]">
                 <div className={`p-2 text-center border-b text-xs font-semibold ${isSameDay(day, new Date()) ? 'text-blue-600 bg-blue-50' : 'text-gray-600'}`}>
                    {format(day, 'EEE d')}
                 </div>
                 <div className="p-1 space-y-1">
                    {dayEvents.map(event => (
                        <div key={event.id} className="text-[10px] p-1 rounded bg-blue-100 text-blue-800 truncate" title={event.title}>
                            {format(parseISO(event.start_time), 'h:mm a')} {event.title}
                        </div>
                    ))}
                 </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12 h-[600px] border rounded-lg bg-gray-50/50">
        <div className="flex flex-col items-center gap-2">
             <Spinner className="h-8 w-8 text-blue-600" />
             <p className="text-gray-500 text-sm">Loading GHL Calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
        {/* Controls */}
      <Card className="border-0 bg-transparent shadow-none p-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
             <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                <Button 
                    variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setViewMode('calendar')}
                    className={`text-xs ${viewMode === 'calendar' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600'}`}
                >
                    <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                    Calendar
                </Button>
                <Button 
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setViewMode('list')}
                    className={`text-xs ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600'}`}
                >
                    List View
                </Button>
                <Button 
                    variant={viewMode === 'week' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setViewMode('week')}
                    className={`text-xs ${viewMode === 'week' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600'}`}
                >
                    Week View
                </Button>
             </div>
             
             <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`h-3.5 w-3.5 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Now'}
             </Button>
          </div>
      </Card>

      {/* View Content */}
      {viewMode === 'calendar' ? (
        <CalendarView events={events} />
      ) : (
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <ScrollArea className="h-[600px]">
              {viewMode === 'list' ? renderListView() : renderWeekView()}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

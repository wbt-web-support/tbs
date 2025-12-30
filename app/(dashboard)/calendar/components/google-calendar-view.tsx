"use client";

import { useState, useEffect } from "react";
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays, subDays } from "date-fns";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar, 
  RefreshCw, 
  Link as LinkIcon, 
  MapPin, 
  Clock, 
  Users,
  CheckCircle2,
  XCircle,
  ExternalLink
} from "lucide-react";
import CalendarView from "./calendar-view";

type GoogleCalendarEvent = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  timezone?: string;
  event_link?: string;
  attendees?: any[];
  status?: string;
};

type BankHoliday = {
  id: string;
  holiday_name: string;
  holiday_date: string;
  year: number;
  is_active: boolean;
};

type UnifiedEvent = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  timezone?: string;
  event_link?: string;
  attendees?: any[];
  status?: string;
};

type ConnectionStatus = {
  connected: boolean;
  account_name?: string;
  last_sync_at?: string;
  sync_status?: string;
};

export default function GoogleCalendarView() {
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [holidays, setHolidays] = useState<BankHoliday[]>([]);
  const [showGoogleCalendar, setShowGoogleCalendar] = useState<boolean>(true);
  const [showHolidays, setShowHolidays] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ connected: false });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'list' | 'week' | 'calendar'>('calendar');
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());
  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    checkConnectionStatus();
    fetchHolidays();
    
    // Check for OAuth callback success
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('connected') === 'true') {
      toast({
        title: "Google Calendar Connected",
        description: "Your Google Calendar has been successfully connected.",
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      checkConnectionStatus();
    }
  }, []);

  useEffect(() => {
    if (connectionStatus.connected && showGoogleCalendar) {
      fetchGoogleEvents();
    }
  }, [connectionStatus.connected, showGoogleCalendar]);

  // Set up automatic sync every 15 minutes
  useEffect(() => {
    if (!connectionStatus.connected) return;

    const syncInterval = setInterval(async () => {
      try {
        setIsSyncing(true);
        const response = await fetch('/api/calendar/google/sync', {
          method: 'POST',
        });

        const data = await response.json();

        if (response.ok) {
          await checkConnectionStatus();
          await fetchGoogleEvents();
        }
      } catch (error) {
        console.error('Auto-sync error:', error);
      } finally {
        setIsSyncing(false);
      }
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(syncInterval);
  }, [connectionStatus.connected]);

  const checkConnectionStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tokenData, error } = await supabase
        .from('google_calendar_tokens')
        .select('account_name, last_sync_at, sync_status')
        .eq('user_id', user.id)
        .single();

      if (error || !tokenData) {
        setConnectionStatus({ connected: false });
        setIsLoading(false);
        return;
      }

      setConnectionStatus({
        connected: true,
        account_name: tokenData.account_name,
        last_sync_at: tokenData.last_sync_at,
        sync_status: tokenData.sync_status,
      });

      // Auto-sync if last sync was more than 15 minutes ago
      if (tokenData.last_sync_at) {
        const lastSync = new Date(tokenData.last_sync_at);
        const now = new Date();
        const minutesSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60);
        if (minutesSinceSync > 15) {
          syncCalendar();
        }
      } else {
        // First time connection, sync immediately
        syncCalendar();
      }
    } catch (error) {
      console.error("Error checking connection status:", error);
      setConnectionStatus({ connected: false });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const response = await fetch('/api/calendar/google/connect');
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to get auth URL');
      }
    } catch (error: any) {
      console.error('Error connecting Google Calendar:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect Google Calendar. Please try again.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const syncCalendar = async () => {
    try {
      setIsSyncing(true);
      const response = await fetch('/api/calendar/google/sync', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync');
      }

      toast({
        title: "Sync Successful",
        description: data.message || `Synced ${data.eventCount} events`,
      });

      await checkConnectionStatus();
      await fetchGoogleEvents();
    } catch (error: any) {
      console.error('Error syncing calendar:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync calendar events.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchGoogleEvents = async () => {
    if (!showGoogleCalendar) return;

    try {
      const now = new Date();
      const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const response = await fetch(
        `/api/calendar/google/events?startDate=${startDate}&endDate=${endDate}`
      );

      if (!response.ok) {
        // Handle non-OK responses gracefully
        if (response.status === 404) {
          console.warn('Calendar events API not found (404). This may be expected if Google Calendar is not connected.');
          setGoogleEvents([]);
          return;
        }
        // For other errors, try to parse error message
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Error fetching Google events:', response.status, errorData);
        setGoogleEvents([]);
        return;
      }

      const data = await response.json();
      setGoogleEvents(data.events || []);
    } catch (error) {
      console.error('Error fetching Google events:', error);
      setGoogleEvents([]);
    }
  };

  const fetchHolidays = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from('bank_holidays')
        .select('*')
        .eq('year', currentYear)
        .eq('is_active', true)
        .order('holiday_date', { ascending: true });

      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch('/api/calendar/google/disconnect', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disconnect');
      }

      toast({
        title: "Disconnected",
        description: "Google Calendar has been disconnected.",
      });

      setConnectionStatus({ connected: false });
      setGoogleEvents([]);
    } catch (error: any) {
      console.error('Error disconnecting:', error);
      toast({
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect Google Calendar.",
        variant: "destructive",
      });
    }
  };

  const getFilteredEvents = (): UnifiedEvent[] => {
    const events: UnifiedEvent[] = [];
    
    if (showGoogleCalendar) {
      events.push(...googleEvents);
    }
    
    if (showHolidays) {
      events.push(...holidays.map(h => ({
        id: h.id,
        title: h.holiday_name,
        start_time: h.holiday_date,
        end_time: h.holiday_date,
        all_day: true,
      })));
    }

    return events.sort((a, b) => {
      const dateA = new Date(a.start_time);
      const dateB = new Date(b.start_time);
      return dateA.getTime() - dateB.getTime();
    });
  };

  const renderListView = () => {
    const events = getFilteredEvents();
    const now = new Date();
    const upcomingEvents = events.filter(e => new Date(e.end_time) >= now);
    const pastEvents = events.filter(e => new Date(e.end_time) < now);

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
                          {('event_link' in event && event.event_link) && (
                            <a
                              href={event.event_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-2">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {event.all_day 
                              ? format(parseISO(event.start_time), 'MMM d, yyyy')
                              : `${format(parseISO(event.start_time), 'MMM d, yyyy h:mm a')} - ${format(parseISO(event.end_time), 'h:mm a')}`
                            }
                          </div>
                          {('location' in event && event.location) && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </div>
                          )}
                          {('attendees' in event && event.attendees && event.attendees.length > 0) && (
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                        {('description' in event && event.description) && (
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
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-3">Past</h3>
            <div className="space-y-2">
              {pastEvents.slice(0, 10).map((event) => (
                <Card key={event.id} className="border-l-4 border-l-gray-300 opacity-70">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-600">{event.title}</h4>
                        <div className="text-xs text-gray-500 mt-1">
                          {format(parseISO(event.start_time), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {events.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No events found</p>
            {!connectionStatus.connected && (
              <p className="text-sm mt-2">Connect your Google Calendar to see events</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const events = getFilteredEvents();

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedWeek(subDays(selectedWeek, 7))}
            >
              ← Previous
            </Button>
            <span className="text-sm font-medium">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedWeek(addDays(selectedWeek, 7))}
            >
              Next →
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedWeek(new Date())}
          >
            Today
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dayEvents = events.filter(e => {
              const eventDate = new Date(e.start_time);
              return isSameDay(eventDate, day);
            });

            return (
              <Card key={day.toISOString()} className="min-h-[200px]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-gray-600">
                    {format(day, 'EEE')}
                  </CardTitle>
                  <div className={`text-lg font-semibold ${
                    isSameDay(day, new Date()) ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {format(day, 'd')}
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className="text-xs p-1 rounded bg-blue-50 text-blue-900 truncate"
                        title={event.title}
                      >
                        {event.all_day ? (
                          event.title
                        ) : (
                          `${format(parseISO(event.start_time), 'h:mm a')} ${event.title}`
                        )}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">

     

      {/* Toggle Controls */}
      <Card className="border-0">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-gray-600">Google Calendar</span>
              <Switch
                checked={showGoogleCalendar}
                onCheckedChange={setShowGoogleCalendar}
                disabled={!connectionStatus.connected}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-gray-600">Holidays</span>
              <Switch
                checked={showHolidays}
                onCheckedChange={setShowHolidays}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>
           
          </div>
        </CardContent>
      </Card>

       {/* Header with Connection Status and Controls */}
       <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Connection Status */}
          {connectionStatus.connected ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <div className="text-xs sm:text-sm">
                <div className="font-medium text-gray-900">Connected</div>
                <div className="text-gray-500">{connectionStatus.account_name}</div>
              </div>
              <Button
                variant="outline"
                size="default"
                onClick={handleDisconnect}
                className="transition-all duration-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
              size="default"
            >
              {isConnecting ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  <span>Connecting...</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  <span>Connect Google Calendar</span>
                </span>
              )}
            </Button>
          )}

          {/* Sync Button */}
          {connectionStatus.connected && (
            <Button
              variant="outline"
              size="default"
              onClick={syncCalendar}
              disabled={isSyncing}
              className="transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <span className="flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
              </span>
            </Button>
          )}
        </div>
      </div>
      </div>
      {/* Events Display */}
      {viewMode === 'calendar' ? (
        <CalendarView events={getFilteredEvents()} />
      ) : (
        <Card className="border-0">
          <CardContent className="p-4 sm:p-6">
            <ScrollArea className="h-[600px]">
              {viewMode === 'list' ? renderListView() : renderWeekView()}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      {connectionStatus.connected && connectionStatus.last_sync_at && (
        <Card className="border-0 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>
                Last synced: {format(parseISO(connectionStatus.last_sync_at), 'MMM d, yyyy h:mm a')}
              </span>
              {connectionStatus.sync_status === 'error' && (
                <Badge variant="destructive" className="ml-2">
                  Sync Error
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


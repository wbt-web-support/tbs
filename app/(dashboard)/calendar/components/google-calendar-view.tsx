"use client";

import { useState, useEffect } from "react";
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays, subDays } from "date-fns";
import { createClient } from "@/utils/supabase/client";
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Calendar, 
  RefreshCw, 
  Link as LinkIcon, 
  MapPin, 
  Clock, 
  Users,
  CheckCircle2,
  ExternalLink,
  Settings
} from "lucide-react";
import CalendarView from "./calendar-view";
import BankHolidaysManager from "./bank-holidays-manager";
import LeaveRequest from "./leave-request";
import AdminCalendarSidebar from "./admin-calendar-sidebar";
import SimplifiedLeaveEntitlement from "./simplified-leave-entitlement";

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
  team_id?: string;
};

type LeaveRequestEvent = {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  duration_days: number;
  description?: string;
  created_at: string;
  user_name?: string;
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
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestEvent[]>([]);
  const [showGoogleCalendar, setShowGoogleCalendar] = useState<boolean>(true);
  const [showHolidaysAndLeave, setShowHolidaysAndLeave] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ connected: false });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'list' | 'week' | 'calendar'>('calendar');
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLeaveManagementOpen, setIsLeaveManagementOpen] = useState<boolean>(false);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState<number>(0);
  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    checkConnectionStatus();
    fetchHolidays();
    fetchUserRole();
    
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

  const fetchUserRole = async () => {
    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;

      const { data: userInfo } = await supabase
        .from('business_info')
        .select('role')
        .eq('user_id', effectiveUserId)
        .single();

      const userIsAdmin = userInfo?.role === 'admin';
      setIsAdmin(userIsAdmin);
      // Refetch leaves after role is determined to show all leaves for admins
      fetchLeaveRequests(userIsAdmin);
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  };

  const fetchHolidays = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userInfo } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', user.id)
        .single();

      if (!userInfo?.team_id) return;

      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from('bank_holidays')
        .select('*')
        .eq('team_id', userInfo.team_id)
        .eq('year', currentYear)
        .eq('is_active', true)
        .order('holiday_date', { ascending: true });

      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    }
  };

  const fetchLeaveRequests = async (userIsAdmin?: boolean) => {
    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;

      // Use the passed parameter if available, otherwise fall back to state
      const adminStatus = userIsAdmin !== undefined ? userIsAdmin : isAdmin;

      // Get user's team_id to fetch team members for name mapping
      const { data: userInfo } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', effectiveUserId)
        .single();

      // For admins, fetch all leaves (RLS policy will filter to team members)
      // For regular users, only fetch their own leaves
      let query = supabase
        .from('team_leaves')
        .select('*');

      if (!adminStatus) {
        query = query.eq('user_id', effectiveUserId);
      }

      const { data: leaves, error } = await query
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user names for all leave requests
      type LeaveData = {
        user_id: string;
        [key: string]: unknown;
      };
      
      type MemberData = {
        user_id: string;
        full_name: string | null;
      };

      const userIds = Array.from(new Set((leaves || []).map((l: LeaveData) => l.user_id)));
      let membersMap = new Map<string, string>();

      if (userIds.length > 0) {
        // For admins, get all team members, for regular users just get their own info
        let nameQuery = supabase
          .from('business_info')
          .select('user_id, full_name');

        if (adminStatus && userInfo?.team_id) {
          // Get all team members
          nameQuery = nameQuery.eq('team_id', userInfo.team_id);
        } else {
          // Get only current user
          nameQuery = nameQuery.eq('user_id', effectiveUserId);
        }

        const { data: members } = await nameQuery;
        if (members) {
          membersMap = new Map((members as MemberData[]).map((m: MemberData) => [m.user_id, m.full_name || 'Unknown']));
        }
      }

      // Map leaves with user names
      const leavesWithNames = (leaves || []).map((leave: LeaveData) => ({
        ...leave,
        user_name: membersMap.get(leave.user_id) || 'Unknown User'
      } as LeaveRequestEvent));

      setLeaveRequests(leavesWithNames);
      
      // Trigger sidebar refresh for admin
      if (adminStatus) {
        setSidebarRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error("Error fetching leave requests:", error);
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
    
    if (showHolidaysAndLeave) {
      // Add holidays
      events.push(...holidays.map(h => ({
        id: h.id,
        title: h.holiday_name,
        start_time: h.holiday_date,
        end_time: h.holiday_date,
        all_day: true,
        status: 'holiday',
      })));
      
      // Add leave requests (excluding rejected ones)
      events.push(...leaveRequests
        .filter(lr => lr.status.toLowerCase() !== 'rejected')
        .map(lr => ({
          id: lr.id,
          title: `${lr.user_name || 'Unknown'}: ${lr.leave_type} (${lr.status})`,
          start_time: lr.start_date,
          end_time: lr.end_date,
          all_day: true,
          description: lr.description,
          status: lr.status,
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
      {/* Controls and Connection Status */}
      <Card className="border-0">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left Side - Controls */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
                <span className="text-xs sm:text-sm text-gray-600">Holidays & Leave</span>
                <Switch
                  checked={showHolidaysAndLeave}
                  onCheckedChange={setShowHolidaysAndLeave}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
              {showHolidaysAndLeave && (
                <>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsLeaveManagementOpen(true)}
                      className="gap-2 px-4 py-5"
                    >
                      <Settings className="h-4 w-4" />
                      Manage Leave
                    </Button>
                  )}
                  <LeaveRequest onLeaveRequested={() => {
                    fetchLeaveRequests();
                  }} />
                </>
              )}
            </div>

            {/* Right Side - Connection Status */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {connectionStatus.connected ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <div className="text-xs sm:text-sm">
                      <div className="font-medium text-gray-900">Connected</div>
                      <div className="text-gray-500">{connectionStatus.account_name}</div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    className="transition-all duration-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                  >
                    Disconnect
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={syncCalendar}
                    disabled={isSyncing}
                    className="transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center gap-2">
                      <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
                    </span>
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                  size="sm"
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
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Events Display with Admin Sidebar */}
      <div className={isAdmin ? "flex gap-4" : ""}>
        <div className={isAdmin ? "flex-1" : ""}>
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
        </div>
        {isAdmin && (
          <AdminCalendarSidebar 
            isOpen={true} 
            refreshTrigger={sidebarRefreshTrigger}
            onLeaveUpdated={() => {
              fetchLeaveRequests();
              setSidebarRefreshTrigger(prev => prev + 1);
            }}
          />
        )}
      </div>

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

      {/* Simplified Leave Management Modal */}
      <Dialog open={isLeaveManagementOpen} onOpenChange={setIsLeaveManagementOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-3 pb-3 border-b flex-shrink-0 bg-white">
            <DialogTitle className="text-xl font-semibold">Leave Settings</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 bg-white">
            <div className="px-6 py-6 space-y-6">
              {/* Leave Entitlement Section */}
              <SimplifiedLeaveEntitlement onUpdated={() => {
                setSidebarRefreshTrigger(prev => prev + 1);
              }} />
              
              {/* Bank Holidays Section */}
              <BankHolidaysManager 
                hideHeader={true}
                onHolidaysUpdated={() => {
                  fetchHolidays();
                  setSidebarRefreshTrigger(prev => prev + 1);
                }} 
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


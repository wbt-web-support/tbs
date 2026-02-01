"use client";

import { useState, useMemo } from "react";
import { Calendar, momentLocalizer, View } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar-styles.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";

// Initialize moment localizer
const localizer = momentLocalizer(moment);

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: {
    description?: string;
    location?: string;
    event_link?: string;
    attendees?: any[];
    status?: string;
  };
};

type CalendarViewProps = {
  events: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    all_day: boolean;
    description?: string;
    location?: string;
    event_link?: string;
    attendees?: any[];
    status?: string;
  }>;
};

export default function CalendarView({ events }: CalendarViewProps) {
  const [currentView, setCurrentView] = useState<View>("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  // Transform events to react-big-calendar format
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return events.map((event) => {
      const start = parseISO(event.start_time);
      const end = parseISO(event.end_time);
      
      // If it's an all-day event, set time to start/end of day
      const eventStart = event.all_day 
        ? new Date(start.getFullYear(), start.getMonth(), start.getDate())
        : start;
      const eventEnd = event.all_day
        ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59)
        : end;

      return {
        id: event.id,
        title: event.title,
        start: eventStart,
        end: eventEnd,
        allDay: event.all_day,
        resource: {
          description: event.description,
          location: event.location,
          event_link: event.event_link,
          attendees: event.attendees,
          status: event.status,
        },
      };
    });
  }, [events]);

  const handleNavigate = (action: "PREV" | "NEXT" | "TODAY") => {
    if (action === "PREV") {
      if (currentView === "month") {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
      } else if (currentView === "week") {
        setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000));
      } else {
        setCurrentDate(new Date(currentDate.getTime() - 24 * 60 * 60 * 1000));
      }
    } else if (action === "NEXT") {
      if (currentView === "month") {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
      } else if (currentView === "week") {
        setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000));
      } else {
        setCurrentDate(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000));
      }
    } else {
      setCurrentDate(new Date());
    }
  };

  const handleViewChange = (view: View) => {
    setCurrentView(view);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    // You can add a modal or details view here
    if (event.resource?.event_link) {
      window.open(event.resource.event_link, "_blank");
    }
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const isHoliday = event.resource?.status === "holiday";
    const isLeaveRequest = event.resource?.status && ["pending", "approved", "rejected"].includes(event.resource.status);
    
    if (isHoliday) {
      return {
        className: "rbc-event-holiday",
        style: {
          backgroundColor: "#166534",
          borderColor: "#14532d",
        },
      };
    }
    
    if (isLeaveRequest) {
      const status = event.resource?.status;
      const colors = {
        pending: { bg: "#f59e0b", border: "#d97706" }, // amber
        approved: { bg: "#10b981", border: "#059669" }, // green
        rejected: { bg: "#ef4444", border: "#dc2626" }, // red
      };
      const color = colors[status as keyof typeof colors] || colors.pending;
      return {
        className: `rbc-event-leave-${status}`,
        style: {
          backgroundColor: color.bg,
          borderColor: color.border,
        },
      };
    }
    
    return {
      className: "rbc-event-google",
      style: {
        backgroundColor: "#3b82f6",
        borderColor: "#2563eb",
      },
    };
  };

  return (
    <Card className="border-0">
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-4">
          {/* Calendar Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleNavigate("PREV")}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleNavigate("TODAY")}
                className="text-xs sm:text-sm"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleNavigate("NEXT")}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium text-gray-900 ml-2">
                {currentView === "month" && format(currentDate, "MMMM yyyy")}
                {currentView === "week" && 
                  `${format(new Date(currentDate.getTime() - (currentDate.getDay() || 7 - 1) * 24 * 60 * 60 * 1000), "MMM d")} - ${format(new Date(currentDate.getTime() + (7 - (currentDate.getDay() || 7)) * 24 * 60 * 60 * 1000), "MMM d, yyyy")}`
                }
                {currentView === "day" && format(currentDate, "MMMM d, yyyy")}
                {currentView === "agenda" && "Agenda"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={currentView === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => handleViewChange("month")}
                className="text-xs sm:text-sm"
              >
                Month
              </Button>
              <Button
                variant={currentView === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => handleViewChange("week")}
                className="text-xs sm:text-sm"
              >
                Week
              </Button>
              <Button
                variant={currentView === "day" ? "default" : "outline"}
                size="sm"
                onClick={() => handleViewChange("day")}
                className="text-xs sm:text-sm"
              >
                Day
              </Button>
              <Button
                variant={currentView === "agenda" ? "default" : "outline"}
                size="sm"
                onClick={() => handleViewChange("agenda")}
                className="text-xs sm:text-sm"
              >
                Agenda
              </Button>
            </div>
          </div>

          {/* Calendar */}
          <div className="rbc-calendar-wrapper" style={{ height: currentView === "month" ? "600px" : currentView === "week" ? "500px" : "400px" }}>
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              view={currentView}
              onView={handleViewChange}
              date={currentDate}
              onNavigate={setCurrentDate}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              popup
              showMultiDayTimes
              step={60}
              timeslots={1}
              defaultDate={new Date()}
              className="rbc-calendar-custom"
              components={{
                toolbar: () => null, // Hide the default toolbar
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Video, Users, BookOpen, ExternalLink } from "lucide-react";

export function KeyDatesActions() {
  const upcomingEvents = [
    {
      id: 1,
      title: "Group Zoom Session",
      date: "May 20",
      time: "60 min",
      type: "Meeting",
      hasLink: true,
      icon: Video,
      status: "upcoming"
    },
    {
      id: 2,
      title: "Meeting Rhythm Module",
      date: "May 26",
      time: "New",
      type: "Learning",
      hasLink: false,
      icon: BookOpen,
      status: "upcoming"
    },
    {
      id: 3,
      title: "Business Review",
      date: "Feb 5",
      time: "Monthly",
      type: "Review",
      hasLink: false,
      icon: Users,
      status: "overdue"
    }
  ];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Upcoming</CardTitle>
              <p className="text-sm text-gray-500">Key dates & actions</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">{upcomingEvents.length} Items</Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {upcomingEvents.map((event) => {
            const IconComponent = event.icon;
            
            return (
              <div key={event.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                {/* Icon */}
                <div className="flex-shrink-0">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <IconComponent className="h-4 w-4 text-gray-600" />
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm text-gray-900 truncate">{event.title}</h4>
                    {event.status === "overdue" && (
                      <Badge variant="destructive" className="text-xs px-2 py-0">!</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{event.date}</span>
                    <span>•</span>
                    <span>{event.time}</span>
                    <span>•</span>
                    <span>{event.type}</span>
                  </div>
                </div>
                
                {/* Action */}
                {event.hasLink && (
                  <Button variant="ghost" size="sm" className="flex-shrink-0 p-2">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Insight */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-900">Next: Structure Monday meetings</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 
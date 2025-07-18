"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckSquare, Gift, PartyPopper, Sparkles, Award, TrendingUp, CalendarCheck, Calendar } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

type TodoItem = {
  id: string;
  benefit_name: string;
  notes: string | null;
  iframe: string | null;
  is_disabled_for_team: boolean;
};

interface TodoListProps {
  todoItems: TodoItem[];
  loading: boolean;
  teamId: string | null;
}

export default function TodoList({ todoItems, loading, teamId }: TodoListProps) {
  const supabase = createClient();

  // Function to determine which icon to show based on benefit name
  const getItemIcon = (itemName: string) => {
    const name = itemName.toLowerCase();
    if (name.includes('bonus')) return Award;
    if (name.includes('discount') || name.includes('offer')) return TrendingUp;
    if (name.includes('free')) return Gift;
    if (name.includes('premium') || name.includes('special')) return Sparkles;
    if (name.includes('call') || name.includes('meeting') || name.includes('booking')) return Calendar;
    return PartyPopper;
  };

  // Function to modify iframe HTML to add proper height and width
  const enhanceIframeForDisplay = (iframeHtml: string): string => {
    try {
      // Parse the iframe HTML and add height/width attributes
      let modifiedIframe = iframeHtml;
      
      // If the iframe doesn't have a height attribute, add one
      if (!modifiedIframe.includes('height=')) {
        modifiedIframe = modifiedIframe.replace('<iframe', '<iframe height="1000"');
      }
      
      // If the iframe doesn't have a width attribute, add one
      if (!modifiedIframe.includes('width=') && !modifiedIframe.includes('style="width:')) {
        modifiedIframe = modifiedIframe.replace('<iframe', '<iframe width="100%"');
      }
      
      // Ensure the iframe allows fullscreen
      if (!modifiedIframe.includes('allowfullscreen')) {
        modifiedIframe = modifiedIframe.replace('<iframe', '<iframe allowfullscreen');
      }
      
      return modifiedIframe;
    } catch (error) {
      console.error('Error enhancing iframe:', error);
      return iframeHtml; // Return original if parsing fails
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (todoItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No to-do items available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CheckSquare className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-semibold">To Do List</h2>
      </div>
      
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-1">
          {todoItems.map((item) => {
            const ItemIcon = getItemIcon(item.benefit_name);
            return (
              <div 
                key={item.id}
                className="transform transition-all duration-300 hover:translate-y-[-2px]"
              >
                <Card className="p-5 h-full hover:shadow-md transition-shadow duration-300 overflow-hidden group relative">
                  <div className="absolute top-0 right-0 w-24 h-24 -mt-12 -mr-12 bg-blue-50 rounded-full opacity-40 group-hover:opacity-70 transition-opacity duration-300" />
                  
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-full bg-blue-50 text-blue-600">
                      <ItemIcon className="w-5 h-5" />
                    </div>
                    
                    <div className="space-y-3 flex-grow">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{item.benefit_name}</h3>
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 hover:bg-blue-100">
                          To Do
                        </Badge>
                      </div>
                      
                      {item.notes && (
                        <p className="text-sm text-muted-foreground">{item.notes}</p>
                      )}
                      
                      {item.iframe && (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-600">Book Your Call</span>
                          </div>
                          <div 
                            className="w-full overflow-hidden bg-white shadow-sm"
                            style={{ 
                              minHeight: '650px',
                              maxWidth: '100%'
                            }}
                            dangerouslySetInnerHTML={{ 
                              __html: enhanceIframeForDisplay(item.iframe) 
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 
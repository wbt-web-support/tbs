"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, CheckSquare, Gift, PartyPopper, Sparkles, Award, TrendingUp, CalendarCheck, Calendar, ExternalLink, X } from "lucide-react";
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
  const [selectedIframe, setSelectedIframe] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        modifiedIframe = modifiedIframe.replace('<iframe', '<iframe height="800"');
      }
      
      // If the iframe doesn't have a width attribute, add one
      if (!modifiedIframe.includes('width=') && !modifiedIframe.includes('style="width:')) {
        modifiedIframe = modifiedIframe.replace('<iframe', '<iframe width="100%"');
      }
      
      // Ensure the iframe allows fullscreen and scrolling
      if (!modifiedIframe.includes('allowfullscreen')) {
        modifiedIframe = modifiedIframe.replace('<iframe', '<iframe allowfullscreen scrolling="auto"');
      }
      
      // Add scrolling attribute if not present
      if (!modifiedIframe.includes('scrolling=')) {
        modifiedIframe = modifiedIframe.replace('<iframe', '<iframe scrolling="auto"');
      }
      
      return modifiedIframe;
    } catch (error) {
      console.error('Error enhancing iframe:', error);
      return iframeHtml; // Return original if parsing fails
    }
  };

  const openIframeModal = (iframe: string) => {
    setSelectedIframe(iframe);
    setIsModalOpen(true);
  };

  const closeIframeModal = () => {
    setIsModalOpen(false);
    setSelectedIframe(null);
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
    <div className="space-y-4 sm:space-y-6">
 
      
      <div className="space-y-4">
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {todoItems.map((item) => {
            const ItemIcon = getItemIcon(item.benefit_name);
            return (
              <div 
                key={item.id}
                className="transform transition-all duration-300 hover:translate-y-[-2px]"
              >
                <Card className="p-4 sm:p-6 h-full hover:shadow-lg transition-all duration-300 overflow-hidden group relative border-l-4 border-l-blue-500 bg-gradient-to-br from-white to-blue-50/30">
                  
                  <div className="relative z-10 space-y-3 sm:space-y-4">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 rounded-full bg-blue-100 text-blue-600 shadow-sm flex-shrink-0">
                        <ItemIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      
                      <div className="flex-grow space-y-2 sm:space-y-3 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-base sm:text-lg text-gray-800 truncate">{item.benefit_name}</h3>
                          
                        </div>
                        
                        {item.notes && (
                          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{item.notes}</p>
                        )}
                      </div>
                    </div>
                    
                    {item.iframe && (
                      <div className="pt-3 sm:pt-4 border-t border-gray-200">
                        <Button
                          onClick={() => openIframeModal(item.iframe!)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 flex items-center gap-2 text-xs sm:text-sm"
                        >
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>Book Your Call</span>
                          <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      {/* Iframe Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 overflow-hidden">
      
          <div className="flex-1 overflow-auto p-2 sm:p-4 pt-0">
            {selectedIframe && (
              <div 
                className="w-full bg-white rounded-lg overflow-auto"
                dangerouslySetInnerHTML={{ 
                  __html: enhanceIframeForDisplay(selectedIframe) 
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RealtimeChatGemini } from "./realtime-chat-gemini";
import { MessageSquare, X } from "lucide-react";
import { Button } from "./ui/button";

const MIN_SIDEBAR_WIDTH = 350;
const MAX_SIDEBAR_WIDTH = 700;

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(MIN_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Add a function to calculate responsive padding
  const getResponsivePadding = useCallback((includeSidebarWidth = false) => {
    let padding = 16; // p-4 base
    if (window.innerWidth >= 1024) padding = 32; // lg:p-8
    else if (window.innerWidth >= 640) padding = 24; // sm:p-6
    
    // Add extra space for scrollbar (typically 17px) and some margin
    const scrollbarWidth = 20;
    
    return {
      top: padding,
      right: includeSidebarWidth ? padding + sidebarWidth + scrollbarWidth : padding,
      bottom: padding,
      left: padding
    };
  }, [sidebarWidth]);

  // Add resize observer for responsive padding
  useEffect(() => {
    const parent = contentRef.current?.parentElement;
    if (!parent) return;

    const observer = new ResizeObserver(() => {
      if (isOpen) {
        const { top, right, bottom, left } = getResponsivePadding(true);
        parent.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
      } else {
        const { top, right, bottom, left } = getResponsivePadding();
        parent.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
      }
    });

    observer.observe(parent);
    return () => observer.disconnect();
  }, [isOpen, getResponsivePadding]);

  // Update the padding effect with transitions
  useEffect(() => {
    const parent = contentRef.current?.parentElement;
    if (!parent) return;

    // Set transition
    parent.style.transition = 'all 0ms ease-in-out';

    if (isOpen) {
      const { top, right, bottom, left } = getResponsivePadding(true);
      parent.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
    } else {
      const { top, right, bottom, left } = getResponsivePadding();
      parent.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
    }

    return () => {
      const { top, right, bottom, left } = getResponsivePadding();
      parent.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
      parent.style.transition = '';
    };
  }, [isOpen, sidebarWidth, getResponsivePadding]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && sidebarRef.current) {
      const width = window.innerWidth - e.clientX;
      if (width >= MIN_SIDEBAR_WIDTH && width <= MAX_SIDEBAR_WIDTH) {
        setSidebarWidth(width);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return (
    <div ref={contentRef} className="relative">
      {/* The floating button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 z-50 rounded-full h-12 w-12 p-0 bg-blue-600 hover:bg-blue-700 text-white ${
          isOpen ? 'hidden' : ''
        }`}
      >
        <MessageSquare className="h-6 w-6" />
      </Button>

      {/* The chat sidebar */}
      <div
        ref={sidebarRef}
        style={{ width: `${sidebarWidth}px` }}
        className={`fixed sm:top-16 top-0 bottom-0 right-0 z-50 bg-white transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Resize handle */}
        <div
          className="absolute top-0 left-[-8px] w-4 h-full group cursor-ew-resize flex items-center justify-center"
          onMouseDown={startResizing}
        >
          <div className={`w-1 h-full bg-blue-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity ${
            isResizing ? 'opacity-100' : ''
          }`} />
        </div>
        
        {/* Visual feedback when resizing */}
        {isResizing && (
          <div className="fixed inset-0 z-50 cursor-ew-resize" />
        )}
        
        <div className="h-full flex flex-col">
          {/* Close button */}
          <div className="absolute top-4 left-4 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Chat component */}
          <div className="flex-1 overflow-y-auto">
            <RealtimeChatGemini hideDebugButton showHeader={false} />
          </div>
        </div>
      </div>
      
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

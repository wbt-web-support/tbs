"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Message } from "./types";

type TranscriptProps = {
  messages: Message[];
  className?: string;
};

export function Transcript({ messages, className }: TranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (messages.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-full text-muted-foreground text-sm",
          className
        )}
      >
        Start speaking to begin the conversation...
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cn("space-y-3 overflow-y-auto", className)}
    >
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            "flex flex-col",
            msg.role === "user" ? "items-end" : "items-start"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">
              {msg.role === "user" ? "You" : "Agent"}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(msg.timestamp)}
            </span>
          </div>
          <div
            className={cn(
              "rounded-lg px-4 py-2 max-w-[80%]",
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            )}
          >
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

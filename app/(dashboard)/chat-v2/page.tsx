"use client";

import { RealtimeChat } from "@/components/realtime-chat";
// Remove DebugSession import
// import { DebugSession } from "@/components/debug-session";
 
export default function ChatPage() {
  return (
    <div className="flex flex-col gap-4">
      {/* Remove DebugSession component */}
      <RealtimeChat />
    </div>
  );
}  
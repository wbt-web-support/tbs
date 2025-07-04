"use client";

import { RealtimeChatGemini } from "@/components/realtime-chat-gemini";
 
export default function ChatPage() {
  return (
    <div className="flex flex-col gap-4">
      {/* Using optimized Groq Whisper + Deepgram TTS component */}
      <RealtimeChatGemini />
    </div>
  );
}  
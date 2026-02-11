"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Transcript } from "./transcript";
import type { Message, VoiceAgentProps } from "./types";

export function VoiceAgent({
  agentId,
  userId,
  teamId,
  userName,
  onMessage,
  onStatusChange,
}: VoiceAgentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addMessage = useCallback(
    (role: "user" | "agent", content: string) => {
      const message: Message = {
        id: `${Date.now()}-${Math.random()}`,
        role,
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, message]);
      onMessage?.(message);
    },
    [onMessage]
  );

  const conversation = useConversation({
    onConnect: () => {
      console.log("[VoiceAgent] ✅ Connected");
      setError(null);
      onStatusChange?.("connected");
    },
    onDisconnect: (details) => {
      // Log the full disconnect reason
      console.log("[VoiceAgent] ❌ Disconnected:", JSON.stringify(details));
      setError(
        details && typeof details === "object"
          ? `Disconnected: ${JSON.stringify(details)}`
          : null
      );
      onStatusChange?.("disconnected");
    },
    onMessage: (msg) => {
      console.log("[VoiceAgent] 💬 Message:", JSON.stringify(msg));
      if (msg.message) {
        addMessage(msg.role === "user" ? "user" : "agent", msg.message);
      }
    },
    onError: (err, context) => {
      console.error("[VoiceAgent] 🔴 Error:", err, context);
      const message = typeof err === "string" ? err : "Connection error";
      setError(message);
    },
    onStatusChange: ({ status }) => {
      console.log("[VoiceAgent] 🔄 Status changed:", status);
    },
  });

  const startConversation = async () => {
    setError(null);

    try {
      // Step 1: Get signed URL from our server
      console.log("[VoiceAgent] 🔑 Fetching signed URL...");
      const response = await fetch(
        `/api/elevenlabs/signed-url?agentId=${encodeURIComponent(agentId)}`
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to get conversation URL");
      }
      const { signedUrl } = await response.json();
      console.log("[VoiceAgent] 🔑 Got signed URL");

      // Step 2: Start session - SDK handles microphone internally
      console.log("[VoiceAgent] 🚀 Starting session...");
      const conversationId = await conversation.startSession({
        signedUrl,
        dynamicVariables: {
          user_id: userId,
          team_id: teamId || "",
          user_name: userName || "",
        },
      });

      console.log("[VoiceAgent] ✅ Session started:", conversationId);
    } catch (err) {
      console.error("[VoiceAgent] 🔴 Failed to start:", err);
      setError(
        err instanceof Error ? err.message : "Failed to start conversation"
      );
    }
  };

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  // Keep a ref for unmount cleanup
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  useEffect(() => {
    return () => {
      conversationRef.current.endSession().catch(() => {});
    };
  }, []);

  const isConnected = conversation.status === "connected";
  const isDisconnected = conversation.status === "disconnected";

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Voice Assistant
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-normal",
                isConnected && "text-green-600",
                !isConnected && !isDisconnected && "text-yellow-600",
                isDisconnected && "text-muted-foreground"
              )}
            >
              {isConnected
                ? conversation.isSpeaking
                  ? "Agent is speaking"
                  : "Agent is listening"
                : isDisconnected
                  ? "Disconnected"
                  : "Connecting..."}
            </span>
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                isConnected && "bg-green-500",
                !isConnected && !isDisconnected && "bg-yellow-500 animate-pulse",
                isDisconnected && "bg-gray-300"
              )}
            />
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm whitespace-pre-wrap break-all">
            {error}
          </div>
        )}

        {/* Transcript */}
        <div className="h-[300px] border rounded-lg p-4 bg-muted/30">
          <Transcript messages={messages} className="h-full" />
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-y-4 items-center">
          <Button
            variant="outline"
            className="rounded-full"
            size="lg"
            disabled={!isDisconnected}
            onClick={startConversation}
          >
            Start conversation
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            size="lg"
            disabled={isDisconnected}
            onClick={stopConversation}
          >
            End conversation
          </Button>
        </div>

        {isDisconnected && !error && (
          <p className="text-center text-sm text-muted-foreground">
            Click &quot;Start conversation&quot; to begin
          </p>
        )}
      </CardContent>
    </Card>
  );
}

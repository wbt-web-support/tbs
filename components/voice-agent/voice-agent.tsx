"use client";

import { useState, useCallback, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Transcript } from "./transcript";
import type { Message, ConnectionStatus, VoiceAgentProps } from "./types";

export function VoiceAgent({
  agentId,
  userId,
  teamId,
  userName,
  onMessage,
  onStatusChange,
}: VoiceAgentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isMuted, setIsMuted] = useState(false);
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
      setStatus("connected");
      setError(null);
      onStatusChange?.("connected");
    },
    onDisconnect: () => {
      setStatus("disconnected");
      onStatusChange?.("disconnected");
    },
    onMessage: (message) => {
      // Handle different message types from ElevenLabs
      if (message.message) {
        addMessage("agent", message.message);
      }
    },
    onError: (err) => {
      console.error("[VoiceAgent] Error:", err);
      setError(err.message || "Connection error");
      setStatus("disconnected");
    },
  });

  const startConversation = async () => {
    setStatus("connecting");
    setError(null);
    onStatusChange?.("connecting");

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Start the conversation with user context
      await conversation.startSession({
        agentId,
        dynamicVariables: {
          user_id: userId,
          team_id: teamId || "",
          user_name: userName || "",
        },
      });
    } catch (err) {
      console.error("[VoiceAgent] Failed to start:", err);
      setError(
        err instanceof Error ? err.message : "Failed to start conversation"
      );
      setStatus("disconnected");
      onStatusChange?.("disconnected");
    }
  };

  const endConversation = async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error("[VoiceAgent] Failed to end:", err);
    }
    setStatus("disconnected");
    onStatusChange?.("disconnected");
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Note: Actual mute implementation depends on ElevenLabs SDK capabilities
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (status === "connected") {
        conversation.endSession().catch(console.error);
      }
    };
  }, [status, conversation]);

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
                status === "connected" && "text-green-600",
                status === "connecting" && "text-yellow-600",
                status === "disconnected" && "text-muted-foreground"
              )}
            >
              {status === "connected" && "Connected"}
              {status === "connecting" && "Connecting..."}
              {status === "disconnected" && "Disconnected"}
            </span>
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                status === "connected" && "bg-green-500",
                status === "connecting" && "bg-yellow-500 animate-pulse",
                status === "disconnected" && "bg-gray-300"
              )}
            />
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* Transcript */}
        <div className="h-[300px] border rounded-lg p-4 bg-muted/30">
          <Transcript messages={messages} className="h-full" />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {status === "disconnected" ? (
            <Button
              size="lg"
              onClick={startConversation}
              className="rounded-full h-14 w-14"
            >
              <Phone className="h-6 w-6" />
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                variant="outline"
                onClick={toggleMute}
                className={cn(
                  "rounded-full h-12 w-12",
                  isMuted && "bg-red-100"
                )}
                disabled={status !== "connected"}
              >
                {isMuted ? (
                  <MicOff className="h-5 w-5 text-red-600" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>

              <Button
                size="lg"
                variant="destructive"
                onClick={endConversation}
                className="rounded-full h-14 w-14"
                disabled={status === "connecting"}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={() => setIsMuted(!isMuted)}
                className="rounded-full h-12 w-12"
                disabled={status !== "connected"}
              >
                {isMuted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </Button>
            </>
          )}
        </div>

        {status === "disconnected" && (
          <p className="text-center text-sm text-muted-foreground">
            Click the button above to start a voice conversation
          </p>
        )}

        {status === "connected" && (
          <p className="text-center text-sm text-muted-foreground">
            Speak naturally. The agent is listening...
          </p>
        )}
      </CardContent>
    </Card>
  );
}

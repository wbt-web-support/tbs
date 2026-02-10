/**
 * Types for Voice Agent components
 */

export type Message = {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
};

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export type VoiceAgentProps = {
  agentId: string;
  userId: string;
  teamId?: string;
  userName?: string;
  onMessage?: (message: Message) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
};

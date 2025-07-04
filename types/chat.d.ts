export interface Message {
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'audio';
  isComplete: boolean;
  isStreaming?: boolean;
  audioUrl?: string;
  audioTimestamp?: number;
  partNumber?: number;
  totalParts?: number;
}

export interface ChatConfig {
  maxTokens: number;
  temperature: number;
  topP: number;
  topK: number;
  generateTitle?: boolean;
}

export interface ChatResponse {
  content: string;
  title?: string;
  isComplete: boolean;
  partNumber?: number;
  totalParts?: number;
}

export interface StreamChunk {
  type: 'stream-chunk';
  content: string;
  isComplete: boolean;
}

export interface StreamComplete {
  type: 'stream-complete';
  content: string;
  isComplete: boolean;
  instanceId: string;
}

export interface TitleUpdate {
  type: 'title-update';
  newTitle: string;
  instanceId: string;
}

export interface ErrorResponse {
  type: 'error';
  error: string;
  details?: string;
}

export type WebSocketResponse = 
  | StreamChunk 
  | StreamComplete 
  | TitleUpdate 
  | ErrorResponse; 
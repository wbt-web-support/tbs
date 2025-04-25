"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Loading } from "./ui/loading";
import { Mic, MicOff, Send, Settings, Phone, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { AudioVisualizer } from "./audio-visualizer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Switch } from "./ui/switch";
import { createClient } from "@/utils/supabase/client";
import ReactMarkdown from 'react-markdown';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  type: "text" | "audio";
  itemId?: string;
  isComplete?: boolean;
}

interface WebSocketMessage {
  type: string;
  event_id?: string;
  response?: {
    output?: Array<{
      id?: string;
      object?: string;
      type?: string;
      status?: string;
      role?: "user" | "assistant";
      content?: Array<{
        type: string;
        text?: string;
        transcript?: string;
      }>;
    }>;
    status?: string;
    id?: string;
    conversation_id?: string;
    modalities?: string[];
    voice?: string;
    output_audio_format?: string;
    temperature?: number;
    max_output_tokens?: string;
    usage?: any;
    metadata?: any;
  };
  item?: {
    id?: string;
    object?: string;
    type?: string;
    status?: string;
    role?: "user" | "assistant";
    content?: Array<{
      type: string;
      text?: string;
      transcript?: string;
    }>;
  };
  delta?: string;
  transcript?: string;
  item_id?: string;
  content_index?: number;
}

interface AudioDevice {
  deviceId: string;
  label: string;
}

// Constants for audio processing
const BUFFER_THRESHOLD_SECONDS = 0.2; // Reduced from 0.3 to minimize latency
const CROSSFADE_DURATION = 0.015; // Increased from 0.005 for smoother transitions
const MIN_BUFFER_SIZE = 2048; // Minimum buffer size for stable playback
const MAX_BUFFER_SIZE = 8192; // Maximum buffer size to prevent delay

export function RealtimeChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const currentTranscriptionItemIdRef = useRef<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);

  
  // --- New state refs for audio playback ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]); // Queue for decoded audio buffers
  const nextPlayTimeRef = useRef<number>(0); // Tracks scheduled start time for next chunk
  const isPlayingAssistantAudioRef = useRef<boolean>(false); // Tracks if playback is active
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(true); // Control playback
  // --- End of new state refs ---

  // Add these state variables at the top with other state declarations
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [gainNode, setGainNode] = useState<GainNode | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const initializeSession = async () => {
      try {
        setError(null);
        setIsLoading(true);
        
        // Get current user ID
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;
        
        console.log("Initializing session for user:", userId);
        
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini-realtime-preview-2024-12-17",
            userId
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create session");
        }

        const data = await response.json();
        console.log("Session created:", data);
        setSessionToken(data.client_secret.value);
        
        // Load chat history (loadChatHistory will handle setting default welcome message if needed)
        await loadChatHistory();
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error initializing session:", error);
        setError(error instanceof Error ? error.message : "Failed to create session");
        setIsLoading(false);
        
        // Set default welcome message if session initialization fails
        setMessages([{
          role: "assistant",
          content: "Welcome. How can I help you?",
          type: "text",
          isComplete: true
        }]);
      }
    };

    initializeSession();
  }, []);

  useEffect(() => {
    if (!sessionToken) return;

    // For transcription mode, we need to connect with intent=transcription
    const ws = new WebSocket(
      `wss://api.openai.com/v1/realtime?intent=transcription`,
      [
        "realtime",
        `openai-insecure-api-key.${sessionToken}`,
        "openai-beta.realtime-v1"
      ]
    );

    ws.onopen = () => {
      console.log("WebSocket connection established.");
      setIsConnected(true);
      setError(null);

      // Basic session configuration based on the OpenAI Realtime Agents approach
      const config = {
        type: "session.update",
        session: {
          input_audio_format: "pcm16",
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 200,
            create_response: true,
          }
        }
      };
      console.log("Configuring transcription session:", JSON.stringify(config, null, 2));
      ws.send(JSON.stringify(config));
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed.");
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError("WebSocket connection error");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;
        console.log("Received message:", JSON.stringify(data, null, 2));
        handleWebSocketMessage(data);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
        setError("Error processing message");
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [sessionToken]);

  useEffect(() => {
    const getAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices
          .filter(device => device.kind === 'audioinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${device.deviceId.slice(0, 5)}...`
          }));
        setAudioDevices(audioInputs);
        
        if (audioInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(audioInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Error getting audio devices:', error);
        setError('Error accessing audio devices');
      }
    };

    getAudioDevices();
  }, []);

  useEffect(() => {
    return () => {
      if (isCallActive) {
        stopRecording();
        setIsCallActive(false);
      }
    };
  }, []);

  // Helper function to clean JSON responses
  const cleanJsonResponse = (content: string): string => {
    if (!content || typeof content !== 'string') return content;
    
    // Check if it looks like JSON (starts with { or [)
    const trimmedContent = content.trim();
    if ((trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) || 
        (trimmedContent.startsWith('[') && trimmedContent.endsWith(']'))) {
      try {
        const jsonData = JSON.parse(trimmedContent);
        
        // Handle different JSON structures
        if (jsonData.action === "acknowledge") {
          return "Message received.";
        } 
        else if (jsonData.message) {
          return jsonData.message;
        }
        else if (jsonData.function) {
          return `I'll help with ${jsonData.function.replace(/[_-]/g, ' ')}.`;
        }
        else if (typeof jsonData === 'object' && jsonData !== null) {
          // For other JSON objects, provide a readable interpretation
          const keys = Object.keys(jsonData);
          if (keys.length === 1) {
            // Handle simple key-value objects more elegantly
            const key = keys[0];
            const value = jsonData[key];
            
            if (typeof value === 'string') {
              return `${key}: ${value}`;
            } else if (typeof value === 'object' && value !== null) {
              return `I have information about ${key}.`;
            }
          }
          
          // Generic fallback for other objects
          return "I have processed your request.";
        }
      } catch (e) {
        console.log("Failed to parse JSON content, keeping as is");
        // Not valid JSON, return original content
      }
    }
    
    // Return original content if no processing was done
    return content;
  };

  const handleWebSocketMessage = (data: WebSocketMessage) => {
    console.log("Handling WebSocket message of type:", data.type);

    if (data.type === "session.updated") {
      console.log("Session updated successfully");
    } 
    else if (data.type === "input_audio_buffer.speech_started") {
      console.log("Speech detected");
      // Add a placeholder message. We will find and update this later.
      setMessages((prev) => {
        // Avoid adding multiple placeholders if events fire rapidly
        const hasPlaceholder = prev.some(m => m.role === "user" && m.type === "audio" && m.content === "Transcribing..." && !m.isComplete);
        if (!hasPlaceholder) {
          console.log("Adding 'Transcribing...' placeholder message.");
          const placeholderMessage: Message = {
            role: "user",
            content: "Transcribing...", 
            type: "audio",
            isComplete: false
          };
          return [...prev, placeholderMessage];
        } else {
          console.log("'Transcribing...' placeholder already exists, skipping addition.");
          return prev;
        }
      });
    } 
    else if (data.type === "input_audio_buffer.speech_stopped") {
      console.log("Speech stopped");
    }
    else if (data.type === "input_audio_buffer.committed") {
      console.log("Audio buffer committed");
    }
    else if (data.type === "conversation.item.created") {
      console.log("Conversation item created", JSON.stringify(data.item, null, 2));
      if (data.item?.role === "user") {
        // For user messages
        let content = "";
        
        // Extract content from different formats following OpenAI Realtime Agents approach
        if (Array.isArray(data.item.content) && data.item.content.length > 0) {
          const contentItem = data.item.content[0];
          if (contentItem.type === "input_text") {
            content = contentItem.text || "";
          }
          // Note: We don't handle audio content here - it's handled by transcription events
        } else if (typeof data.item.content === "string") {
          content = data.item.content;
        }

        if (content) {
          const newMessage: Message = {
            role: "user",
            content: content,
            type: "text",
            isComplete: true
          };
          
          setMessages((prev) => {
            // Remove any temporary transcribing message
            const filtered = prev.filter(m => !(m.role === "user" && m.type === "audio" && !m.isComplete));
            // Check for duplicates
            const isDuplicate = filtered.some(
              (msg) => msg.role === newMessage.role && msg.content === newMessage.content
            );
            return isDuplicate ? filtered : [...filtered, newMessage];
          });
        }
      } else if (data.item?.role === "assistant") {
        // For assistant messages
        let content = "";
        if (Array.isArray(data.item.content) && data.item.content.length > 0) {
          content = data.item.content[0]?.text || "";
        } else if (typeof data.item.content === "string") {
          content = data.item.content;
        }
        
        if (content) {
          const newMessage: Message = {
            role: "assistant",
            content: content,
            type: "text",
          };
          
          setMessages((prev) => {
            const isDuplicate = prev.some(
              (msg) => msg.role === newMessage.role && msg.content === newMessage.content
            );
            return isDuplicate ? prev : [...prev, newMessage];
          });
        }
      }
    }
    // Key event for transcription - similar to OpenAI Realtime Agents approach
    else if (data.type === "conversation.item.input_audio_transcription.completed") {
      console.log("Received completed transcription event:", JSON.stringify(data, null, 2));
      const finalTranscript = typeof data.transcript === 'string' && data.transcript.trim() 
        ? data.transcript.trim() 
        : "[Transcription empty or failed]";

      setMessages((prev) => {
        // Find the *last* message that looks like our placeholder
        const transcriptionIndex = prev.findLastIndex(msg => 
            msg.role === "user" && 
            msg.type === "audio" && 
            !msg.isComplete
        );
        
        if (transcriptionIndex >= 0) {
          console.log(`Updating placeholder at index ${transcriptionIndex} with final transcript:`, finalTranscript);
          const updatedMessages = [...prev];
          updatedMessages[transcriptionIndex] = {
            ...prev[transcriptionIndex],
            content: finalTranscript,
            isComplete: true,
            itemId: data.item_id || prev[transcriptionIndex].itemId // Assign the final item ID
          };
          return updatedMessages;
        } else {
          // If no placeholder found (maybe missed speech_started?), create a new message.
          console.log("No placeholder found, creating new completed transcription message:", finalTranscript);
          const newMessage: Message = {
            role: "user",
            content: finalTranscript,
            type: "audio",
            itemId: data.item_id,
            isComplete: true
          };
          return [...prev, newMessage];
        }
      });
    } 
    // Handle incremental transcription updates
    else if (data.type === "conversation.item.input_audio_transcription.delta") {
      console.log("Received transcription delta event:", JSON.stringify(data, null, 2));
      if (data.delta) {
        const deltaText = data.delta || "";
        setMessages((prev) => {
          // Find the *last* message that looks like our placeholder or is being transcribed
          const transcriptionIndex = prev.findLastIndex(msg => 
            msg.role === "user" && 
            msg.type === "audio" && 
            !msg.isComplete
          );
          
          if (transcriptionIndex >= 0) {
            const updatedMessages = [...prev];
            const existingMessage = prev[transcriptionIndex];
            const newContent = existingMessage.content === "Transcribing..." 
              ? deltaText 
              : existingMessage.content + deltaText;
            
            updatedMessages[transcriptionIndex] = {
              ...existingMessage,
              content: newContent,
              itemId: data.item_id || existingMessage.itemId // Assign item ID if available
            };
            
            console.log(`Updated message at index ${transcriptionIndex} with delta. New content:`, newContent);
            return updatedMessages;
          } else {
            // If no placeholder found, create a new message with the delta
            console.log("No placeholder found, creating new message with delta:", deltaText);
            const newMessage: Message = {
              role: "user",
              content: deltaText,
              type: "audio",
              itemId: data.item_id,
              isComplete: false
            };
            return [...prev, newMessage];
          }
        });
      }
    }
    else if (data.type === "response.output_item.added") {
      console.log("Output item added:", JSON.stringify(data.item, null, 2));
      // Handle assistant messages from response output
      if (data.item?.role === "assistant") {
        let content = "";
        let type: "text" | "audio" = "text";
        
        if (Array.isArray(data.item.content) && data.item.content.length > 0) {
          const contentItem = data.item.content[0];
          if (contentItem.type === "text") {
            content = contentItem.text || "";
          } else if (contentItem.type === "audio") {
            content = contentItem.transcript || "Assistant audio";
            type = "audio"; // Mark as audio type, even if we display transcript
          }
        } else if (typeof data.item.content === "string") {
          content = data.item.content;
        }

        // Clean up JSON response
        content = cleanJsonResponse(content);
        
        if (content) {
          const newMessage: Message = {
            role: "assistant",
            content: content,
            type: type, // Use determined type
          };
          
          setMessages((prev) => {
            // Consider updating existing assistant message if partial responses come
            const isDuplicate = prev.some(
              (msg) => msg.role === newMessage.role && msg.content === newMessage.content
            );
            return isDuplicate ? prev : [...prev, newMessage];
          });
        }
      }
    } 
    else if (data.type === "response.done") {
      console.log("Response done:", JSON.stringify(data, null, 2));
      if (data.response?.output && Array.isArray(data.response.output)) {
        const outputItem = data.response.output[0];
        if (outputItem) {
          let content = "";
          let type: "text" | "audio" = "text";
          
          if (outputItem.content && Array.isArray(outputItem.content)) {
            const contentItem = outputItem.content[0];
            if (contentItem?.type === "text") {
              content = contentItem.text || "";
            } else if (contentItem?.type === "audio") {
              content = contentItem.transcript || "Assistant audio";
              type = "audio"; // Mark as audio type
            }
          } else if (typeof outputItem.content === "string") {
            content = outputItem.content;
          }

          // Clean up JSON response
          content = cleanJsonResponse(content);
          
          if (content) {
            const newMessage: Message = {
              role: "assistant",
              content: content,
              type: type, // Use determined type
            };

            setMessages((prev) => {
              const isDuplicate = prev.some(
                (msg) => msg.role === newMessage.role && msg.content === newMessage.content
              );
              // Add the final message if not already added by output_item.added
              return isDuplicate ? prev : [...prev, newMessage];
            });
          }
        }
      }
      setIsLoading(false);
    } 
    else if (data.type === "error") {
      console.error("Server error:", data);
      setError("Server error: " + (data as any).error?.message || "Unknown error");
      setIsLoading(false);
    }
    // Add handler for response.audio.delta
    else if (data.type === "response.audio.delta" && data.delta) {
      console.log("Received audio delta, length:", data.delta.length);
      
      if (!audioContext || !isAudioPlaybackEnabled) {
        console.log("Audio playback disabled or context not ready");
        return;
      }

      // Process the audio data
      processAudioData(data.delta).then((audioBuffer) => {
        if (audioBuffer) {
          // Add to queue and try to play
          audioQueueRef.current.push(audioBuffer);
          console.log("Added audio buffer to queue, length:", audioQueueRef.current.length);
          playQueuedAudio().catch(err => {
            console.error("Error playing queued audio:", err);
          });
        }
      }).catch(err => {
        console.error("Error processing audio data:", err);
      });
    }
    // Add handler for response.audio.done (optional, could be used for cleanup)
    else if (data.type === "response.audio.done") {
        console.log("Audio response completed");
    }
  };

  const handleSendMessage = () => {
    if (!wsRef.current || !inputText.trim() || isLoading) return;

    setIsLoading(true);
    const userMessage: Message = {
      role: "user",
      content: inputText,
      type: "text",
    };
    setMessages((prev) => [...prev, userMessage]);

    const message = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: inputText,
          },
        ],
      },
    };
    console.log("Sending text message:", message);
    wsRef.current.send(JSON.stringify(message));

    const responseEvent = {
      type: "response.create",
      response: {
        modalities: ["text"]
      }
    };
    console.log("Requesting response:", responseEvent);
    wsRef.current.send(JSON.stringify(responseEvent));

    setInputText("");
  };

  const toggleCall = async () => {
    if (isCallActive) {
      // End call
      try {
        stopRecording();
        setIsCallActive(false);

        // Clear the buffer
        if (wsRef.current) {
          const clearMessage = {
            type: "input_audio_buffer.clear"
          };
          wsRef.current.send(JSON.stringify(clearMessage));
          console.log("Cleared audio buffer after ending call");
        }

        // Reset loading state to ensure UI is ready for next recording
        setIsLoading(false);
      } catch (error) {
        console.error("Error ending call:", error);
        setError("Error ending call: " + (error instanceof Error ? error.message : "Unknown error"));
        setIsLoading(false);
      }
    } else {
      // Start call
      if (isLoading) return; // Don't start a call while loading
      
      try {
        setIsLoading(true);
        console.log("Starting call mode");

        // Clear any existing audio buffer when starting a new call
        if (wsRef.current) {
          const clearMessage = {
            type: "input_audio_buffer.clear"
          };
          wsRef.current.send(JSON.stringify(clearMessage));
          console.log("Cleared audio buffer before starting call");
        }

        // Reset error state
        setError(null);
        
        // Start recording
        await startRecording();
        setIsCallActive(true);
        setIsLoading(false);
      } catch (error) {
        console.error("Error starting call:", error);
        setError("Error starting call. Please check your microphone permissions.");
        setIsLoading(false);
      }
    }
  };

  const startRecording = async () => {
    if (!wsRef.current) {
      console.error("WebSocket connection not established");
      setError("WebSocket connection not established");
      return;
    }
    
    try {
      setError(null);
      
      // Make sure any previous audioStream is fully cleaned up
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      }
      
      console.log("Starting recording with device:", selectedDeviceId);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          channelCount: 1,
          sampleRate: 24000,
          sampleSize: 16,
        }
      });
      console.log("Audio stream obtained successfully:", stream.getAudioTracks()[0].label);
      setAudioStream(stream);
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      // Make sure chunks are reset
      audioChunksRef.current = [];
      let accumulatedChunks = 0;
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const chunk = new Float32Array(inputData);
        audioChunksRef.current.push(chunk);
        
        // Calculate the duration of accumulated audio
        // Each chunk is 4096 samples at 24000Hz = 170.6ms
        // We need to accumulate at least 100ms before sending
        accumulatedChunks++;
        const accumulatedDurationMs = (accumulatedChunks * 4096 / 24000) * 1000;
        
        // Immediately send audio data to server for real-time processing
        if (wsRef.current && accumulatedDurationMs >= 200) { // Send in ~200ms chunks
          try {
            // Merge accumulated chunks
            const totalLength = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
            const mergedData = new Float32Array(totalLength);
            let offset = 0;
            audioChunksRef.current.forEach(chunk => {
              mergedData.set(chunk, offset);
              offset += chunk.length;
            });
            
            // Convert to PCM16
            const pcm16Data = new Int16Array(mergedData.length);
            for (let i = 0; i < mergedData.length; i++) {
              const s = Math.max(-1, Math.min(1, mergedData[i]));
              pcm16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }

            // Convert to base64
            let binary = '';
            const bytes = new Uint8Array(pcm16Data.buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64Audio = btoa(binary);

            // Send to server - no need to commit with server VAD
            const appendMessage = {
              type: "input_audio_buffer.append",
              audio: base64Audio
            };
            wsRef.current.send(JSON.stringify(appendMessage));
            console.log(`Sent audio chunk, length: ${base64Audio.length}, duration: ${accumulatedDurationMs.toFixed(2)}ms`);
            
            // Clear accumulated chunks after sending
            audioChunksRef.current = [];
            accumulatedChunks = 0;
          } catch (error) {
            console.error("Error sending audio chunk:", error);
          }
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.onstop = () => {
        if (!audioChunksRef.current.length) {
          console.error("No audio data collected");
          setError("No audio data collected. Please try again.");
          return;
        }
        
        source.disconnect();
        processor.disconnect();
        audioContext.close();
        audioChunksRef.current = [];
        
        // Don't set loading state here, since it gets handled elsewhere
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      setError("Error accessing microphone. Please check your permissions.");
      setIsCallActive(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
        if (audioStream) {
          audioStream.getTracks().forEach(track => {
            try {
              track.stop();
            } catch (e) {
              console.error("Error stopping track:", e);
            }
          });
          setAudioStream(null);
        }
        setIsRecording(false);
        // Reset the media recorder reference
        mediaRecorderRef.current = null;
      } catch (error) {
        console.error("Error in stopRecording:", error);
        // Continue with cleanup even if there's an error
        setAudioStream(null);
        setIsRecording(false);
        mediaRecorderRef.current = null;
      }
    }
  };

  // Initialize audio context with proper settings
  useEffect(() => {
    if (!audioContext) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000,
          latencyHint: 'interactive'
        });
        
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.value = 0.8; // Slightly reduce volume to prevent clipping
        
        setAudioContext(ctx);
        setGainNode(gain);
        
        // Resume context on user interaction
        const resumeContext = async () => {
          if (ctx.state === 'suspended') {
            await ctx.resume();
            console.log("AudioContext resumed on user interaction");
          }
        };
        document.addEventListener('click', resumeContext);
        document.addEventListener('touchstart', resumeContext);
        
        return () => {
          document.removeEventListener('click', resumeContext);
          document.removeEventListener('touchstart', resumeContext);
          gain.disconnect();
          ctx.close();
        };
      } catch (err) {
        console.error("Error initializing AudioContext:", err);
        setError("Could not initialize audio playback");
      }
    }
  }, []);

  // Improved audio processing function
  const processAudioData = async (base64Data: string): Promise<AudioBuffer | null> => {
    if (!audioContext) {
      console.error("AudioContext not initialized");
      return null;
    }

    try {
      // 1. Decode Base64
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      let audioBytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        audioBytes[i] = binaryString.charCodeAt(i);
      }

      // 2. Handle byte alignment for Int16
      if (audioBytes.byteLength % 2 !== 0) {
        console.warn("Received audio data with odd byte length, padding with zero");
        const paddedBytes = new Uint8Array(len + 1);
        paddedBytes.set(audioBytes);
        paddedBytes[len] = 0;
        audioBytes = paddedBytes;
      }

      // 3. Convert to Int16Array
      const pcm16Data = new Int16Array(audioBytes.buffer, audioBytes.byteOffset, audioBytes.byteLength / 2);

      // 4. Convert to Float32Array with normalization
      const float32Data = new Float32Array(pcm16Data.length);
      for (let i = 0; i < pcm16Data.length; i++) {
        const sample = pcm16Data[i];
        float32Data[i] = sample < 0 ? sample / 32768.0 : sample / 32767.0;
      }

      // 5. Calculate and remove DC offset
      let dcOffset = 0;
      for (let i = 0; i < float32Data.length; i++) {
        dcOffset += float32Data[i];
      }
      dcOffset /= float32Data.length;

      // 6. Create and fill AudioBuffer
      const audioBuffer = audioContext.createBuffer(
        1, // mono
        float32Data.length,
        audioContext.sampleRate
      );
      const channelData = audioBuffer.getChannelData(0);

      // Apply DC offset removal and simple low-pass filter
      let prevSample = 0;
      const alpha = 0.05; // Smoothing factor for low-pass filter
      for (let i = 0; i < float32Data.length; i++) {
        // Remove DC offset and apply low-pass filter
        const sample = float32Data[i] - dcOffset;
        prevSample = sample * alpha + prevSample * (1 - alpha);
        channelData[i] = prevSample;
      }

      return audioBuffer;
    } catch (error) {
      console.error("Error processing audio data:", error);
      return null;
    }
  };

  // Improved playback function with better timing and crossfading
  const playQueuedAudio = async () => {
    if (!audioContext || !gainNode || audioQueueRef.current.length === 0) {
      return;
    }

    if (isPlayingAssistantAudioRef.current) {
      return; // Already playing
    }

    if (!isAudioPlaybackEnabled) {
      console.log("Playback disabled, clearing queue.");
      audioQueueRef.current = [];
      return;
    }

    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
        console.log("AudioContext resumed successfully");
      } catch (err) {
        console.error("Failed to resume AudioContext:", err);
        setError("Audio playback failed. Please interact with the page to enable audio.");
        return;
      }
    }

    // Calculate total buffered duration
    const totalQueuedDuration = audioQueueRef.current.reduce((sum, buffer) => sum + buffer.duration, 0);

    // Wait for more data if below threshold
    if (totalQueuedDuration < BUFFER_THRESHOLD_SECONDS) {
      console.log(`Buffering... Queued: ${totalQueuedDuration.toFixed(3)}s`);
      return;
    }

    isPlayingAssistantAudioRef.current = true;
    console.log(`Starting playback with ${audioQueueRef.current.length} chunks`);

    // Initialize next play time if needed
    if (nextPlayTimeRef.current <= 0) {
      nextPlayTimeRef.current = audioContext.currentTime + 0.1;
    }

    const playNextChunk = () => {
      if (!audioContext || !gainNode || !isAudioPlaybackEnabled) {
        audioQueueRef.current = [];
        isPlayingAssistantAudioRef.current = false;
        nextPlayTimeRef.current = 0;
        return;
      }

      if (audioQueueRef.current.length === 0) {
        isPlayingAssistantAudioRef.current = false;
        return;
      }

      const audioBuffer = audioQueueRef.current.shift();
      if (!audioBuffer) return;

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Create gain node for this chunk
      const chunkGain = audioContext.createGain();
      source.connect(chunkGain);
      chunkGain.connect(gainNode);

      // Calculate precise timing
      const currentTime = audioContext.currentTime;
      const startTime = Math.max(currentTime, nextPlayTimeRef.current);
      
      // Apply crossfading
      const timeDifference = startTime - currentTime;
      if (timeDifference < CROSSFADE_DURATION) {
        // Fade in
        chunkGain.gain.setValueAtTime(0, startTime);
        chunkGain.gain.linearRampToValueAtTime(1, startTime + CROSSFADE_DURATION);
        
        // Fade out at the end
        const endTime = startTime + audioBuffer.duration;
        chunkGain.gain.setValueAtTime(1, endTime - CROSSFADE_DURATION);
        chunkGain.gain.linearRampToValueAtTime(0, endTime);
      }

      try {
        source.start(startTime);
        
        // Schedule next chunk
        const duration = audioBuffer.duration;
        nextPlayTimeRef.current = startTime + duration - CROSSFADE_DURATION;
        
        // Schedule the next chunk slightly before this one ends
        const timeUntilNext = (nextPlayTimeRef.current - currentTime) * 0.95;
        
        const timeoutId = setTimeout(() => {
          if (isPlayingAssistantAudioRef.current) {
            playNextChunk();
          }
        }, Math.max(10, timeUntilNext * 1000));

        source.onended = () => {
          clearTimeout(timeoutId);
          chunkGain.disconnect();

          if (isPlayingAssistantAudioRef.current && 
              audioContext && 
              audioContext.currentTime >= nextPlayTimeRef.current + CROSSFADE_DURATION) {
            playNextChunk();
          }
        };

      } catch (err) {
        console.error("Error starting audio:", err);
        if (audioContext) {
          nextPlayTimeRef.current = audioContext.currentTime + 0.1;
        }
        chunkGain.disconnect();
        setTimeout(playNextChunk, 100);
      }
    };

    playNextChunk();
  };

  // Effect to scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Modify the loadChatHistory function
  const loadChatHistory = async () => {
    try {
      console.log('Loading chat history...');
      setIsLoadingHistory(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('User session in chat:', session, 'Error:', sessionError);

      if (!session || !session.user) {
        console.log('No user found in chat session');
        // Add a default welcome message if no user is found
        setMessages([
          {
            role: "assistant",
            content: "Welcome. How can I help you?",
            type: "text",
            isComplete: true
          }
        ]);
        return;
      }

      console.log('Fetching chat history for user:', session.user.id);
      const { data, error } = await supabase
        .from('chat_history')
        .select('messages')
        .eq('user_id', session.user.id)
        .single();

      console.log('Chat history response:', data, 'Error:', error);
      if (error) {
        if (error.code === 'PGRST116') {
          // No chat history found for this user, this is normal for new users
          console.log('No chat history found for user, setting default welcome message');
          setMessages([
            {
              role: "assistant",
              content: "Welcome. How can I help you?",
              type: "text",
              isComplete: true
            }
          ]);
        } else {
          // Some other error occurred
          throw error;
        }
      } else if (data && data.messages && data.messages.length > 0) {
        // We have chat history, use it
        setMessages(data.messages);
      } else {
        // We have a record but no messages, set default welcome message
        setMessages([
          {
            role: "assistant",
            content: "Welcome. How can I help you?",
            type: "text",
            isComplete: true
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      toast.error('Failed to load chat history');
      // Add a default welcome message if there's an error
      setMessages([
        {
          role: "assistant",
          content: "Welcome. How can I help you?",
          type: "text",
          isComplete: true
        }
      ]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Modify the saveChatHistory function
  const saveChatHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        console.log('No user found, skipping chat history save');
        return;
      }

      // Only save if there are messages
      if (messages.length === 0) {
        return;
      }

      // Use upsert to either insert a new record or update the existing one
      const { error } = await supabase
        .from('chat_history')
        .upsert(
          {
            user_id: session.user.id,
            messages: messages
          },
          {
            onConflict: 'user_id'
          }
        );

      if (error) {
        console.error('Error saving chat history:', error);
      } else {
        console.log('Chat history saved successfully');
      }
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  // Modify the clearChatHistory function
  const clearChatHistory = async () => {
    try {
      setIsClearingChat(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        console.log('No user found, skipping chat history clear');
        return;
      }

      // Just update the record with an empty messages array
      const { error } = await supabase
        .from('chat_history')
        .upsert(
          {
            user_id: session.user.id,
            messages: [{
              role: "assistant",
              content: "Welcome. How can I help you?",
              type: "text",
              isComplete: true
            }]
          },
          {
            onConflict: 'user_id'
          }
        );

      if (error) {
        console.error('Error clearing chat history:', error);
        return;
      }

      // Set default welcome message after clearing
      setMessages([
        {
          role: "assistant",
          content: "Welcome. How can I help you?",
          type: "text",
          isComplete: true
        }
      ]);
    } catch (error) {
      console.error('Error clearing chat history:', error);
    } finally {
      setIsClearingChat(false);
    }
  };

  // Modify the useEffect for saving chat history
  useEffect(() => {
    if (messages.length > 0) {
      // Add a small delay to prevent too frequent saves
      const timeoutId = setTimeout(() => {
        saveChatHistory();
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-white to-gray-50 rounded-xl border max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-center p-4 border-b bg-white/80 backdrop-blur-sm rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
            A
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Bot</h2>
            <p className="text-xs text-gray-500">Trades Business School</p>
          </div>
          {isLoadingHistory && (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
              <span className="text-sm text-gray-500">Loading history...</span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearChatHistory}
          disabled={isClearingChat}
          className="text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 transition-colors"
        >
          {isClearingChat ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
              <span>Clearing...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                <line x1="10" x2="10" y1="11" y2="17"></line>
                <line x1="14" x2="14" y1="11" y2="17"></line>
              </svg>
              <span>Clear Chat</span>
            </div>
          )}
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-240px)]" ref={scrollAreaRef}>
          <div className="space-y-4 p-6 pt-12">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                } animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-[70%] rounded-xl px-4 py-2 shadow-sm flex items-center ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                      : "bg-slate-100 text-gray-800 border flex flex-col items-baseline"
                  } ${message.type === "audio" && !message.isComplete ? "opacity-80" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {message.type === "audio" && !message.isComplete && (
                      <span className="text-xs font-medium flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        voice message...
                      </span>
                    )}
                  </div>
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="text-sm leading-relaxed">{children}</p>,
                          h1: ({ children }) => <h1 className="text-lg font-bold mt-2 mb-1">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-base font-bold mt-2 mb-1">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>,
                          ul: ({ children }) => <ul className="list-disc list-inside my-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside my-2">{children}</ol>,
                          li: ({ children }) => <li className="text-sm">{children}</li>,
                          code: ({ children }) => (
                            <code className="bg-gray-200 rounded px-1 py-0.5 text-sm font-mono text-wrap">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className=" rounded-xl p-4 my-2 overflow-x-auto w-full">
                              {children}
                            </pre>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-gray-300 pl-2 my-2 italic">
                              {children}
                            </blockquote>
                          ),
                          a: ({ href, children }) => (
                            <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.type === "audio" && !message.isComplete ? "" : message.content}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="max-w-[70%] flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="rounded-xl px-4 py-2 bg-slate-100 border shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-sm text-gray-500">Bot is typing</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="p-4 border-t bg-white/80 backdrop-blur-sm rounded-b-xl">
        <div className="flex flex-col gap-3">
          {isCallActive ? (
            // Call Active UI - Only show stop button and audio visualization
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="text-sm font-medium text-gray-700">Recording...</span>
                </div>
                
                <Button
                  variant="destructive"
                  onClick={toggleCall}
                  className="flex items-center gap-1 rounded-full px-4 shadow-sm bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                  disabled={!isConnected || isLoading}
                >
                  {isLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <MicOff className="h-4 w-4 mr-1" />
                  )}
                  <span>End</span>
                </Button>
              </div>
              
              <AudioVisualizer isRecording={isRecording} stream={audioStream} />
            </div>
          ) : (
            // Normal UI - Show all options
            <div className="flex items-center gap-2">
              <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 transition-colors">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Audio Settings</DialogTitle>
                  </DialogHeader>
                  <div className="py-4">
                    <label className="text-sm font-medium mb-2 block">
                      Select Microphone
                    </label>
                    <Select
                      value={selectedDeviceId}
                      onValueChange={setSelectedDeviceId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a microphone" />
                      </SelectTrigger>
                      <SelectContent>
                        {audioDevices.map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="mt-4 flex items-center justify-between">
                      <label htmlFor="audio-playback" className="text-sm font-medium">
                        Enable Assistant Audio
                      </label>
                      <Switch 
                        id="audio-playback" 
                        checked={isAudioPlaybackEnabled} 
                        onCheckedChange={setIsAudioPlaybackEnabled}
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsAudioPlaybackEnabled(!isAudioPlaybackEnabled)} 
                title={isAudioPlaybackEnabled ? "Disable Audio" : "Enable Audio"}
                className="h-9 w-9 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 transition-colors hidden"
              >
                {isAudioPlaybackEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  className="w-full px-4 py-2 rounded-full border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-white shadow-sm transition-all"
                  placeholder="Type a message..."
                  disabled={!isConnected || isLoading}
                />
                {inputText && (
                  <Button 
                    className="absolute right-1 top-1 h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-sm transition-all" 
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!isConnected || isLoading || !inputText.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Button
                variant="outline"
                onClick={toggleCall}
                className="flex items-center gap-1 rounded-full px-3 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
                disabled={!isConnected || isLoading}
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                <span className="text-xs">Speak</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
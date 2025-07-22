"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Volume2, VolumeX, Menu, Sidebar, Edit2, Trash2, Plus, X, Send,
  MessageSquare, Cog, Lightbulb, Square, Check, Mic, Star
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AudioVisualizer } from "./audio-visualizer";
import { EnhancedVoiceControls } from "./enhanced-voice-controls";
import { SubtleVoiceIndicator } from './voice-feedback/SubtleVoiceIndicator';
import { useVoiceFeedback } from '@/hooks/useVoiceFeedback';
import { WebSocketVoiceClient } from '@/lib/websocket-client';
import type { WebSocketClientCallbacks } from '@/lib/websocket-client';
import { startTransition } from 'react';
import { groupChatsByTime, formatRelativeTime, getTimeGroupsForDisplay, getStarredCountDisplay } from '@/utils/chat-organization';
import type { ChatInstance as ChatInstanceType } from '@/utils/chat-organization';
import { toast } from 'sonner';
import { 
  Message, 
  ChatConfig, 
  ChatResponse, 
  WebSocketResponse 
} from '@/types/chat';
import { generateChatTitle } from '../lib/title-generator';
import { enhancedAudioHandler } from '@/lib/enhanced-audio-handler';
import { browserTTSService } from '@/lib/browser-tts-service';


interface Message {
  role: "user" | "assistant";
  content: string;
  type: "text";
  isComplete?: boolean;
  isStreaming?: boolean;
  isVoiceMessage?: boolean;
  audioUrl?: string;
  audioTimestamp?: number;
  partNumber?: number;
}

interface ChatInstance {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_starred?: boolean;
}

interface ChatbotInstruction {
  id: string;
  title: string;
  content: string;
  content_type: string;
  url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  extraction_metadata: any;
}

const MEDIUM_SCREEN_BREAKPOINT = 768; // Tailwind 'md' breakpoint

// Add onReady to the props type
interface RealtimeChatGeminiProps {
  hideDebugButton?: boolean;
  showHeader?: boolean;
  hideInstanceSidebar?: boolean;
  selectedInstanceId?: string | null;
  onInstanceChange?: ((instanceId: string) => void) | null;
  onReady?: () => void; // New prop
  onTitleUpdate?: () => void; // Auto-title update callback
}

export function RealtimeChatGemini({ 
  hideDebugButton = false, 
  showHeader = true, 
  hideInstanceSidebar = false,
  selectedInstanceId = null,
  onInstanceChange = null,
  onReady, // Destructure new prop
  onTitleUpdate // Auto-title update callback
}: RealtimeChatGeminiProps = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentStreamingMessageRef = useRef<string>('');
  // Essential audio state for WebSocket TTS
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [lastMessageWasVoice, setLastMessageWasVoice] = useState(false);
  
  // 🧹 OPTIMIZATION 2: Simplified to essential audio only (removed 5 redundant audio systems)
  
  // Enhanced voice controls state
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState<{[key: number]: number}>({});
  const [audioDuration, setAudioDuration] = useState<{[key: number]: number}>({});
  
  // Session-based control tracking - using session start time
  const sessionStartTime = useRef<number>(Date.now());
  
  // Essential data loading states  
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [selectedAccent, setSelectedAccent] = useState<'US' | 'UK'>('UK');
  const [selectedGender, setSelectedGender] = useState<'female' | 'male'>('female');
  
  // Voice interface controls
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [audioVolume, setAudioVolume] = useState(0.8);
  // 🧹 OPTIMIZATION 3: Removed playback animation state (unnecessary visual overhead)
  
  // Enhanced features state
  const [useEnhancedFeatures, setUseEnhancedFeatures] = useState(true);
  const [vadEnabled, setVadEnabled] = useState(true);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [vadCalibrated, setVadCalibrated] = useState(false);
  
  // 🧹 OPTIMIZATION 1: Removed call mode dead code (was ~200 lines of unused functionality)
  
  // Debug state (kept for future use)
  const [showBotTyping, setShowBotTyping] = useState(false);
  const [audioPlaceholder, setAudioPlaceholder] = useState<any>(null);
  const [currentPlayingMessageIndex, setCurrentPlayingMessageIndex] = useState<number | null>(null);
  const messageAudioRefs = useRef<{[key: number]: HTMLAudioElement}>({});
  
  // Multi-instance state
  const [chatInstances, setChatInstances] = useState<ChatInstance[]>([]);
  const [currentInstanceId, setCurrentInstanceId] = useState<string | null>(selectedInstanceId);
  const [showInstanceSidebar, setShowInstanceSidebar] = useState(!hideInstanceSidebar); // For desktop
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isLoadingInstances, setIsLoadingInstances] = useState(true);
  const [starringInstance, setStarringInstance] = useState<string | null>(null);

  // Responsive state
  const [isMediumScreen, setIsMediumScreen] = useState(false);
  const [mobileInstancesPanelOpen, setMobileInstancesPanelOpen] = useState(false);
  
  // WebSocket state
  const [wsClient, setWsClient] = useState<WebSocketVoiceClient | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsStreamingText, setWsStreamingText] = useState("");
  const [wsProcessingStatus, setWsProcessingStatus] = useState<string | null>(null);
  
  // Voice feedback state management
  const voiceFeedback = useVoiceFeedback('idle');
  
  // 🎯 NEW: Voice message status indicators
  const [isThinking, setIsThinking] = useState(false);
  
  const supabase = createClient();

  // Debug useEffect to monitor messages changes
  useEffect(() => {
    console.log('🔍 [DEBUG] Messages state changed, length:', messages.length);
    console.log('🔍 [DEBUG] Last message:', messages[messages.length - 1]);
  }, [messages]);

  // Sync voice feedback state with component state
  useEffect(() => {
    if (error) {
      if (error.includes('microphone') || error.includes('permission')) {
        voiceFeedback.setError('microphone-permission', error);
      } else if (error.includes('network') || error.includes('connection')) {
        voiceFeedback.setError('network-error', error);
      } else if (error.includes('speech') || error.includes('recognized')) {
        voiceFeedback.setError('speech-not-recognized', error);
      } else {
        voiceFeedback.setError('api-failure', error);
      }
    } else if (isLoading && !isRecording) {
      if (wsStreamingText) {
        voiceFeedback.setState('generating');
        voiceFeedback.setProcessingText('Generating response...');
      } else {
        voiceFeedback.setState('thinking');
        voiceFeedback.setProcessingText('Processing your message...');
      }
    } else if (isRecording) {
      voiceFeedback.setState('recording');
      voiceFeedback.setProcessingText('Recording your voice...');
    } else if (isAudioPlaying) {
      voiceFeedback.setState('speaking');
      voiceFeedback.setProcessingText('Playing response...');
    } else if (!error && !isLoading && !isRecording && !isAudioPlaying) {
      voiceFeedback.setState('idle');
    }
  }, [error, isLoading, isRecording, isAudioPlaying, wsStreamingText, voiceFeedback]);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMediumScreen(window.innerWidth < MEDIUM_SCREEN_BREAKPOINT);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // OPTIMIZATION 20: Initialize WebSocket connection with client reusing
  useEffect(() => {
    const initializeWebSocket = async () => {
      console.log('🔗 [WS] Initializing WebSocket connection (OPTIMIZED)...');
      
      // Check if we already have a connected client
      if (wsClient && wsConnected) {
        console.log('🔄 [WS] Reusing existing WebSocket client');
        return;
      }
      
      const callbacks: WebSocketClientCallbacks = {
        onConnected: () => {
          console.log('✅ [WS] Connected to WebSocket server');
          setWsConnected(true);
          setWsProcessingStatus('Connected - Ready for ultra-fast voice processing');
        },
        onDisconnected: () => {
          console.log('🔌 [WS] Disconnected from WebSocket server');
          setWsConnected(false);
          setWsProcessingStatus('Disconnected - Falling back to HTTP');
        },
        onTranscription: (data) => {
          console.log('🎤 [WS] Transcription received');
          if (data.status === 'complete' && data.text) {
            console.log(`✅ [WS] Adding user message: "${data.text}"`);
            setWsProcessingStatus(`Transcribed: "${data.text}"`);
            
            // 🚀 OPTIMIZATION 8: Streamlined transcription handling (removed debug overhead)
            setMessages(prev => [
                ...prev,
                { role: 'user', content: data.text, type: 'text', isVoiceMessage: true, isComplete: true }
            ]);
            
            // 🎯 NEW: Set thinking status after WebSocket transcription
            setIsThinking(true);
            console.log("🤔 [WS STATUS] Set thinking... (transcription complete)");
          }
        },
        onAIChunk: (data) => {
          console.log('🤖 [WS] AI chunk received');
          console.log('🔍 [WS] AI chunk content preview:', data.fullText?.substring(0, 100) + '...');
          console.log('🔗 [WS] AI chunk has links:', data.fullText?.includes('[Company Scorecard]'));
          
          // 🎯 NEW: Clear thinking status when WebSocket AI response starts
          if (isThinking) {
            setIsThinking(false);
            console.log("💭 [WS STATUS] Cleared thinking... (AI response started)");
          }
          
          // 🚀 OPTIMIZATION 8: Streamlined AI chunk processing (removed debug overhead)
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            
            if (lastIdx >= 0 && updated[lastIdx].role === "assistant" && !updated[lastIdx].isComplete) {
              // Update existing streaming message
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: data.fullText,
                isComplete: data.isComplete,
                isStreaming: !data.isComplete
              };
            } else if (lastIdx < 0 || updated[lastIdx].role !== "assistant" || updated[lastIdx].isComplete) {
              // Create new assistant message
              updated.push({
                role: "assistant",
                content: data.fullText,
                type: "text",
                isComplete: data.isComplete,
                isStreaming: !data.isComplete
              });
            }
            
            return updated;
          });
          
          // Check if AI response is complete for TTS
          if (data.isComplete) {
            console.log('🎵 [WS] AI complete, expecting TTS');
          }
          
          // Store streaming text for potential TTS fallback
          setWsStreamingText(data.fullText);
        },
        onTTSAudio: (data) => {
          console.log('🎤 [TTS] Deepgram audio received via WebSocket:', data);
          console.log('🎤 [TTS] Data keys:', Object.keys(data));
          console.log('🎤 [TTS] Audio data length:', data.audio?.length || 0);
          console.log('🎤 [TTS] MIME type:', data.mimeType);
          console.log('🔍 [TTS] Original text preview:', data.originalText?.substring(0, 100) + '...');
          console.log('🔗 [TTS] Original text has links:', data.originalText?.includes('[Company Scorecard]'));
          
          if (!isVoiceEnabled) {
            console.log('🔇 [TTS] Voice disabled - skipping playback');
            return;
          }
          
          // Create audio URL from base64 data
          let audioUrl = '';
          if (data.audioUrl) {
            audioUrl = data.audioUrl;
          } else if (data.audio) {
            audioUrl = `data:${data.mimeType || 'audio/mp3'};base64,${data.audio}`;
          } else {
            console.error('❌ [TTS] No audio data or URL found in WebSocket response');
            return;
          }
          
          console.log('🎵 [TTS] Playing WebSocket audio:', audioUrl.substring(0, 50) + '...');
          
          // Play audio immediately using existing audio element
          if (audioRef.current) {
            audioRef.current.src = audioUrl;
            audioRef.current.volume = audioVolume;
            
            audioRef.current.play().then(() => {
              console.log('✅ [TTS] WebSocket Deepgram audio playing successfully');
              
              // 🎯 NEW: Clear thinking status when WebSocket voice starts playing
              setIsThinking(false);
              console.log("🎵 [WS STATUS] Voice started - cleared thinking status");
            }).catch(error => {
              console.warn('⚠️ [TTS] WebSocket Deepgram playback failed:', error);
              // Auto-fallback to browser TTS - use clean text for audio
              if (data.text && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(data.text); // Clean text for voice
                utterance.rate = 1.1;
                utterance.volume = 0.8;
                speechSynthesis.speak(utterance);
                console.log('🔄 [TTS] Browser TTS auto-fallback activated');
                
                // 🎯 NEW: Clear thinking status when fallback voice starts playing
                setIsThinking(false);
                console.log("🎵 [WS STATUS] Fallback voice started - cleared thinking status");
              }
            });
          }
          
          // CRITICAL: Update message with formatted originalText for display
          setMessages(prev => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            if (lastIndex >= 0 && updated[lastIndex].role === "assistant") {
              const formatredContent = data.originalText || updated[lastIndex].content;
              updated[lastIndex] = {
                ...updated[lastIndex],
                content: formatredContent, // ALWAYS use formatted originalText from TTS
                audioUrl: audioUrl,
                audioTimestamp: Date.now()
              };
              console.log('✅ [TTS] Audio URL and FORMATTED content updated in message display');
              console.log('🔗 [TTS] Message now has links:', formatredContent?.includes('[Company Scorecard]'));
            } else {
              console.warn('⚠️ [TTS] No assistant message found to attach audio');
            }
            return updated;
          });
        },
        onTTSFallback: (data) => {
          console.log('🔄 [TTS FALLBACK] Starting browser TTS');
          console.log('🔍 [TTS FALLBACK] Clean text for audio:', data.text?.substring(0, 100) + '...');
          console.log('🔍 [TTS FALLBACK] Original text preview:', data.originalText?.substring(0, 100) + '...');
          console.log('🔗 [TTS FALLBACK] Original text has links:', data.originalText?.includes('[Company Scorecard]'));
          
          // 🚀 OPTIMIZATION 8: Fast browser TTS fallback (removed debug overhead)
          try {
            if (!isVoiceEnabled || !('speechSynthesis' in window) || !data.text) {
              return;
            }
            
            console.log('🔄 [TTS FALLBACK] Playing clean audio text:', data.text.substring(0, 50) + '...');
            
            // Use browser TTS with minimal overhead - CLEAN text for audio
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(data.text); // Clean text for voice
            utterance.rate = 1.1;
            utterance.volume = 0.8;
            
            // Get best available voice quickly
            const voices = speechSynthesis.getVoices();
            const preferredVoice = voices.find(voice => 
              voice.name.includes('Google') || 
              voice.name.includes('Microsoft') ||
              voice.lang.includes('en-US')
            );
            
            if (preferredVoice) {
              utterance.voice = preferredVoice;
              console.log('🔍 [TTS FALLBACK] Using voice:', preferredVoice.name);
            }
            
            speechSynthesis.speak(utterance);
            console.log('✅ [TTS FALLBACK] Browser TTS utterance queued for playback');
            
            // CRITICAL: Update message display with FORMATTED originalText
            setMessages(prev => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;
              if (lastIndex >= 0 && updated[lastIndex].role === "assistant") {
                const formattedContent = data.originalText || updated[lastIndex].content;
                updated[lastIndex] = {
                  ...updated[lastIndex],
                  content: formattedContent // ALWAYS use formatted originalText for display
                };
                console.log('✅ [TTS FALLBACK] Updated message display with FORMATTED content');
                console.log('🔗 [TTS FALLBACK] Message now has links:', formattedContent?.includes('[Company Scorecard]'));
              }
              return updated;
            });
            
          } catch (error) {
            console.error('❌ [TTS FALLBACK CALLBACK] Error in fallback callback:', error);
          }
        },
        onComplete: (data) => {
          console.log('✅ [WS CALLBACK] Voice processing completed:', data);
          setWsProcessingStatus(`Completed in ${data.totalTime}ms - Ultra-fast!`);
          setIsLoading(false);
          
          // 🎯 AUTO-TITLE: Trigger title refresh after message completion
          if (onTitleUpdate) {
            setTimeout(() => onTitleUpdate(), 1000); // Delay to ensure API processing is complete
          }
        },
        onTextChunk: (data) => {
          console.log('📝 [WS CALLBACK] Text chunk received:', data.content?.length, 'chars');
          
          // Add or update the AI response in real-time (similar to onAIChunk)
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            
            if (lastIdx >= 0 && updated[lastIdx].role === "assistant" && !updated[lastIdx].isComplete) {
              // Update existing streaming message
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: data.content,
                isComplete: data.isComplete || false,
              };
            } else {
              // Add new assistant message
              updated.push({
                role: "assistant",
                content: data.content,
                type: "text",
                isVoiceMessage: false,
                isComplete: data.isComplete || false,
                timestamp: Date.now()
              });
            }
            
            return updated;
          });

          // Clear thinking status when text response starts
          if (isThinking) {
            setIsThinking(false);
            console.log("💭 [WS STATUS] Cleared thinking... (text response started)");
          }
        },
        onTextComplete: (data) => {
          console.log('✅ [WS CALLBACK] Text processing completed:', data);
          setWsProcessingStatus(`Text completed in ${data.totalTime}ms - Ultra-fast!`);
          setIsLoading(false);
          
          // 🎯 AUTO-TITLE: Trigger title refresh after text message completion
          if (onTitleUpdate) {
            setTimeout(() => onTitleUpdate(), 1000); // Delay to ensure API processing is complete
          }
        },
        
        // 🚀 REAL-TIME TITLE UPDATES: Handle title updates from WebSocket
        onTitleUpdate: (data) => {
          console.log('🏷️ [WS CALLBACK] Title updated:', data);
          console.log('🏷️ [WS CALLBACK] Current instances before update:', chatInstances);
          console.log('🏷️ [WS CALLBACK] Current instance ID:', currentInstanceId);
          
          // Update instance title in real-time
          if (data.instanceId && data.newTitle) {
            console.log('🏷️ [WS CALLBACK] Updating instance', data.instanceId, 'with title:', data.newTitle);
            setChatInstances(prev => {
              const updated = prev.map(instance => 
                instance.id === data.instanceId 
                  ? { ...instance, title: data.newTitle, updated_at: new Date().toISOString() }
                  : instance
              );
              console.log('🏷️ [WS CALLBACK] Updated instances:', updated);
              return updated;
            });
            
            // If this is the current instance, refresh the UI
            if (data.instanceId === currentInstanceId && onTitleUpdate) {
              console.log('🏷️ [WS CALLBACK] This is current instance, calling onTitleUpdate');
              onTitleUpdate();
            }
          } else {
            console.log('🏷️ [WS CALLBACK] Missing instanceId or newTitle in data:', data);
          }
        },
        onError: (error) => {
          console.error('❌ [WS CALLBACK] Error:', error);
          setWsProcessingStatus(`Error: ${error}`);
          setIsLoading(false);
        }
      };

      // OPTIMIZATION 21: Reuse existing client or create new one efficiently
      let client = wsClient;
      if (!client) {
        console.log('🔧 [WS DEBUG] Creating NEW WebSocket client with callbacks');
        console.log('🔧 [WS DEBUG] onTTSFallback callback exists:', !!callbacks.onTTSFallback);
        client = new WebSocketVoiceClient(callbacks);
        setWsClient(client);
      } else {
        console.log('🔧 [WS DEBUG] Updating callbacks for EXISTING WebSocket client');
        console.log('🔧 [WS DEBUG] onTTSFallback callback exists:', !!callbacks.onTTSFallback);
        // Update callbacks for existing client
        client.updateCallbacks(callbacks);
        
        // Force verify the callback was registered
        const status = client.getConnectionStatus();
        console.log('🔧 [WS DEBUG] Client connection status:', status);
      }

      try {
        if (!wsConnected) {
          await client.connect();
          console.log('🚀 [WS] WebSocket client ready for ultra-fast voice processing (OPTIMIZED)');
        }
      } catch (error) {
        console.warn('⚠️ [WS] WebSocket connection failed, using HTTP fallback:', error);
        setWsProcessingStatus('Using HTTP mode - WebSocket unavailable');
        setWsConnected(false);
        // Don't throw error, just continue with HTTP fallback
      }
    };

    initializeWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsClient) {
        wsClient.disconnect();
      }
      

    };
  }, []);



  // Modified handleSendMessage to work with both text input and voice transcription
  const handleSendMessageWithText = async (messageText?: string) => {
    const textToSend = messageText || inputText.trim();
    
    if (!textToSend) return;
    
    console.log('📤 [SEND] Sending message:', textToSend);
    setIsLoading(true);
    
    // Clear input if using typed input
    if (!messageText) {
      setInputText("");
    }
    
    // Add user message if not already added (voice messages are added by the callback)
    if (!messageText) {
      setMessages(prev => [...prev, { role: "user", content: textToSend, type: "text" }]);
    }

    // 🎯 NEW: Update instance timestamp when sending message
    if (currentInstanceId) {
      updateInstanceTimestamp(currentInstanceId);
    }
    
    try {
      // Use WebSocket if connected, otherwise fallback to HTTP
      if (wsConnected && wsClient) {
        console.log('🚀 [WS] Using optimized WebSocket for AI response...');
        
        // Get user session for WebSocket processing
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || '';
        
        await wsClient.sendMessage(
          textToSend, 
          false, // Text input = Text output only (no TTS)
          userId,
          selectedAccent,
          selectedGender,
          messages.map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }]
          })),
          currentInstanceId // Pass the current instance ID
        );
        return;
      }
      
      // Fallback to HTTP if WebSocket is not available
      console.log('🔄 [HTTP] Using HTTP fallback for AI response...');
      await handleHttpMessage(textToSend);
      
    } catch (error) {
      console.error("❌ [SEND] Error:", error);
      setError("Failed to send message. Please try again.");
      setIsLoading(false);
    }
  };

  // Load chat instances and history on mount
  useEffect(() => {
    const loadInitialData = async () => {
    if (!hideInstanceSidebar) {
        await fetchChatInstances();
    } else if (selectedInstanceId) {
      setCurrentInstanceId(selectedInstanceId);
        await fetchInstanceHistory(selectedInstanceId);
    } else {
        await fetchUserAndHistory();
      }
      // Call onReady after initial data is fetched
      if (onReady) {
        onReady();
    }
    };
    loadInitialData();
  }, [hideInstanceSidebar, selectedInstanceId, onReady]); // Added onReady to dependency array

  // Update current instance when external prop changes
  useEffect(() => {
    if (selectedInstanceId && selectedInstanceId !== currentInstanceId) {
      setCurrentInstanceId(selectedInstanceId);
      fetchInstanceHistory(selectedInstanceId);
    }
  }, [selectedInstanceId]);

  // Effect to automatically scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // OPTIMIZATION 26B: Enhanced audio element with preloading and fast decoding
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // 🧹 OPTIMIZATION 2: Simplified audio configuration (removed complex pooling & WebAudio)
    audio.preload = 'auto';
    audio.volume = audioVolume;
    
    const handlePlay = () => {
      console.log("Audio playback started");
      setIsAudioPlaying(true);
    };
    
    const handlePause = () => {
      console.log("Audio playback paused");
      setIsAudioPlaying(false);
    };
    
    const handleEnded = () => {
      console.log("Audio playback ended");
      setIsAudioPlaying(false);
    };
    
    // 🧹 OPTIMIZATION 4: Essential audio events only (removed monitoring overhead)
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Cleanup effect when component unmounts  
  useEffect(() => {
    return () => {
      // Clean up audio streams
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [audioStream]);

  // Update volume for all audio elements when volume setting changes
  useEffect(() => {
    // Update main WebSocket audio volume
    if (audioRef.current) {
      audioRef.current.volume = audioVolume;
    }
    
    // Update all enhanced controls audio volumes
    Object.values(messageAudioRefs.current).forEach(audio => {
      if (audio) {
        audio.volume = audioVolume;
      }
    });
  }, [audioVolume]);

  // Function to fetch all chat instances
  const fetchChatInstances = async () => {
    try {
      setIsLoadingInstances(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      if (userId) {
        const response = await fetch('/api/gemini?action=instances', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch chat instances');
        }

        const data = await response.json();
        
        if (data.type === 'chat_instances' && Array.isArray(data.instances)) {
          setChatInstances(data.instances);
          
          // Try to restore from session storage first
          const persistedInstanceId = sessionStorage.getItem('currentChatInstanceId');
          let instanceToSelect = null;
          
          if (persistedInstanceId && data.instances.find(i => i.id === persistedInstanceId)) {
            // Persisted instance exists, use it
            instanceToSelect = persistedInstanceId;
            console.log('🔄 [SESSION] Restoring persisted instance:', persistedInstanceId);
          } else if (!currentInstanceId && data.instances.length > 0) {
            // No persisted instance, select the most recent one
            instanceToSelect = data.instances[0].id; // Already sorted by updated_at desc
            console.log('🔄 [SESSION] Selecting most recent instance:', instanceToSelect);
          }
          
          if (instanceToSelect) {
            setCurrentInstanceId(instanceToSelect);
            sessionStorage.setItem('currentChatInstanceId', instanceToSelect);
            await fetchInstanceHistory(instanceToSelect);
            if (onInstanceChange) {
              onInstanceChange(instanceToSelect);
            }
          } else if (data.instances.length === 0) {
            // No instances exist, create a new one
            console.log('🔄 [SESSION] No instances found, creating new one');
            await createNewInstance();
          }
        } else if (data.instances?.length === 0) {
          // No instances exist, create a new one
          console.log('🔄 [SESSION] No instances found, creating new one');
          await createNewInstance();
        }
      }
    } catch (error) {
      console.error('Error fetching chat instances:', error);
      // Fallback to creating a new instance
      await createNewInstance();
    } finally {
      setIsLoadingInstances(false);
      setIsDataLoaded(true); // Mark data as loaded here
    }
  };

  // Function to fetch history for a specific instance
  const fetchInstanceHistory = async (instanceId: string) => {
    try {
      setIsLoadingHistory(true);
      console.log('🔄 [FETCH-HISTORY] Starting fetch for instance:', instanceId);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        console.error('❌ [FETCH-HISTORY] No authenticated session found');
        setMessages([]);
        return;
      }

      console.log('🔄 [FETCH-HISTORY] Making API request with user:', session.user.id?.slice(-8));
      
      const response = await fetch(`/api/gemini?action=instance&instanceId=${instanceId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      console.log('🔄 [FETCH-HISTORY] API response status:', response.status);

      if (!response.ok) {
        // Get the error details from the response
        let errorMessage = 'Failed to fetch instance history';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.details || errorMessage;
          console.error('❌ [FETCH-HISTORY] API error response:', errorData);
        } catch (parseError) {
          console.error('❌ [FETCH-HISTORY] Failed to parse error response:', parseError);
        }
        
        // If the instance is not found (404), try to fallback to direct database query
        if (response.status === 404) {
          console.log('🔄 [FETCH-HISTORY] Instance not found via API, trying direct DB query...');
          try {
            const { data: directInstance, error: directError } = await supabase
              .from('chat_history')
              .select('*')
              .eq('id', instanceId)
              .eq('user_id', session.user.id)
              .single();

            if (directError) {
              console.error('❌ [FETCH-HISTORY] Direct DB query also failed:', directError);
              throw new Error(`Instance not found: ${directError.message}`);
            }

            if (directInstance) {
              console.log('✅ [FETCH-HISTORY] Found instance via direct DB query');
              const history = directInstance.messages || [];
              const formattedHistory = history.map((msg: any) => ({
                role: msg.role === 'model' || msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content || '',
                type: 'text',
                isComplete: true
              })) as Message[];
              
              setMessages(formattedHistory);
              console.log('✅ [FETCH-HISTORY] Instance history loaded via direct DB:', formattedHistory.length, 'messages');
              return;
            }
          } catch (directError) {
            console.error('❌ [FETCH-HISTORY] Direct database fallback failed:', directError);
          }
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('🔄 [FETCH-HISTORY] API response data type:', data.type);
      
      if (data.type === 'chat_instance' && data.instance) {
        const history = data.instance.messages || [];
        const formattedHistory = history.map((msg: any) => ({
          role: msg.role === 'model' || msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content || '',
          type: 'text',
          isComplete: true
        })) as Message[];
        
        setMessages(formattedHistory);
        console.log('✅ [FETCH-HISTORY] Instance history loaded:', formattedHistory.length, 'messages');
      } else if (data.type === 'error') {
        console.error('❌ [FETCH-HISTORY] API returned error:', data.error);
        throw new Error(data.error || 'Unknown API error');
      } else {
        console.log('⚠️ [FETCH-HISTORY] No instance data found, setting empty messages');
        setMessages([]);
      }
      
    } catch (error) {
      console.error('❌ [FETCH-HISTORY] Error fetching instance history:', error);
      setMessages([]);
      
      // Show user-friendly error message
      if (error instanceof Error) {
        console.error('❌ [FETCH-HISTORY] Detailed error:', error.message);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Function to create a new chat instance - SIMPLIFIED VERSION
  const createNewInstance = async (title: string = 'New Chat') => {
    try {
      console.log('🔄 [NEW-CHAT] Creating new chat instance directly...');
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        console.error('❌ [NEW-CHAT] No authenticated session found');
        alert('Please sign in to create a new chat');
        return;
      }

      console.log('🔄 [NEW-CHAT] Creating chat instance directly in Supabase...');
      
      // Create new chat instance directly via Supabase (bypass crashing API)
      const { data: newInstance, error } = await supabase
        .from('chat_history')
        .insert({
          user_id: session.user.id,
          title: title,
          messages: []
        })
        .select('id, title, created_at, updated_at')
        .single();

      if (error) {
        console.error('❌ [NEW-CHAT] Supabase error:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (newInstance) {
        console.log('✅ [NEW-CHAT] Successfully created new chat instance:', newInstance.id);
        
        // Update UI state
        setCurrentInstanceId(newInstance.id);
        setMessages([]); // Start with empty messages for new instance
        
        // Store in session storage for persistence
        sessionStorage.setItem('currentChatInstanceId', newInstance.id);
        
        // Add to local instances list
        setChatInstances(prev => [newInstance, ...prev]);
        
        // Reset session tracking when creating new instance
        sessionStartTime.current = Date.now();
        
        if (onInstanceChange) {
          onInstanceChange(newInstance.id);
        }
        
        console.log('✅ [NEW-CHAT] Updated UI state - currentInstanceId:', newInstance.id);
        
      } else {
        throw new Error('No instance data returned from database');
      }
    } catch (error) {
      console.error('❌ [NEW-CHAT] Error creating new chat instance:', error);
      alert(`Failed to create new chat: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Function to handle instance selection
  const handleInstanceSelect = async (instanceId: string) => {
    if (instanceId === currentInstanceId) return; // Already selected
    
    try {
      setCurrentInstanceId(instanceId);
      setMessages([]); // Clear current messages
      setIsLoadingHistory(true);
      
      // Persist the selected instance
      sessionStorage.setItem('currentChatInstanceId', instanceId);
      
      // Fetch history for the selected instance
      await fetchInstanceHistory(instanceId);
      
      // Update URL or any other state as needed
      if (onInstanceChange) {
        onInstanceChange(instanceId);
      }
      
      console.log('🔄 [SESSION] Selected instance:', instanceId);
    } catch (error) {
      console.error('Error switching to instance:', error);
      setIsLoadingHistory(false);
    }
  };

  // Function to save title changes
  const handleTitleSave = async (instanceId: string) => {
    if (!editingTitle.trim()) {
      setEditingInstanceId(null);
      setEditingTitle("");
      return;
    }

    try {
      await updateInstanceTitle(instanceId, editingTitle.trim());
      setEditingInstanceId(null);
      setEditingTitle("");
    } catch (error) {
      console.error('Error saving title:', error);
      // Revert on error
      setEditingInstanceId(null);
      setEditingTitle("");
    }
  };

  // Function to delete a chat instance - DIRECT DATABASE CALL
  const deleteInstance = async (instanceId: string) => {
    if (!instanceId) return;

    try {
      console.log('🗑️ [DIRECT-DB] Deleting instance directly via Supabase...');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('No authenticated session');
      }

      // Direct database call (bypass broken HTTP endpoint)
      const { error } = await supabase
        .from('chat_history')
        .delete()
        .eq('id', instanceId)
        .eq('user_id', session.user.id);

      if (error) {
        console.error('❌ [DIRECT-DB] Database error:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('✅ [DIRECT-DB] Successfully deleted instance');
      
      // Stop any playing audio if this is the current instance
      if (currentInstanceId === instanceId) {
        console.log('🔊 [AUDIO-CLEANUP] Stopping audio for deleted chat...');
        
        // Stop HTML audio element
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          console.log('✅ [AUDIO-CLEANUP] Stopped HTML audio element');
        }
        
        // Stop Enhanced Audio Handler (Deepgram audio)
        enhancedAudioHandler.stop();
        console.log('✅ [AUDIO-CLEANUP] Stopped enhanced audio handler');
        
        // Stop Browser TTS Service
        browserTTSService.stop();
        console.log('✅ [AUDIO-CLEANUP] Stopped browser TTS service');
        
        // Stop Web Speech Synthesis (fallback)
        if ('speechSynthesis' in window) {
          speechSynthesis.cancel();
          console.log('✅ [AUDIO-CLEANUP] Cancelled speech synthesis');
        }
      }
      
      // Update local state
      const updatedInstances = chatInstances.filter(instance => instance.id !== instanceId);
      setChatInstances(updatedInstances);
      
      // If we deleted the current instance, select another one
      if (currentInstanceId === instanceId) {
        console.log('🗑️ [DIRECT-DB] Deleted current instance, switching to another...');
        sessionStorage.removeItem('currentChatInstanceId');
        
        if (updatedInstances.length > 0) {
          const newInstance = updatedInstances[0];
          setCurrentInstanceId(newInstance.id);
          sessionStorage.setItem('currentChatInstanceId', newInstance.id);
          fetchInstanceHistory(newInstance.id);
          if (onInstanceChange) {
            onInstanceChange(newInstance.id);
          }
          console.log('✅ [DIRECT-DB] Switched to instance:', newInstance.id);
        } else {
          // No instances left, create a new one
          console.log('🗑️ [DIRECT-DB] No instances left, creating new one...');
          await createNewInstance();
        }
      }
      
      console.log('✅ [DIRECT-DB] Instance deletion completed successfully');
      return true;
    } catch (error) {
      console.error('❌ [DIRECT-DB] Error deleting chat instance:', error);
      throw error;
    }
  };

  // Function to update instance title - DIRECT DATABASE CALL
  const updateInstanceTitle = async (instanceId: string, newTitle: string) => {
    try {
      console.log('🔄 [DIRECT-DB] Updating instance title directly via Supabase...');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('No authenticated session');
      }

      // Direct database call (bypass broken HTTP endpoint)
      const { error } = await supabase
        .from('chat_history')
        .update({ 
          title: newTitle,
          updated_at: new Date().toISOString()
        })
        .eq('id', instanceId)
        .eq('user_id', session.user.id);

      if (error) {
        console.error('❌ [DIRECT-DB] Database error:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('✅ [DIRECT-DB] Successfully updated instance title');
      
      // Update local state
      setChatInstances(prev => 
        prev.map(instance => 
          instance.id === instanceId 
            ? { ...instance, title: newTitle, updated_at: new Date().toISOString() }
            : instance
        )
      );

      setEditingInstanceId(null);
      setEditingTitle("");

      return true;
    } catch (error) {
      console.error('❌ [DIRECT-DB] Error updating instance title:', error);
      throw error;
    }
  };

  // Function to select an instance
  const selectInstance = (instanceId: string) => {
    if (instanceId !== currentInstanceId) {
      setCurrentInstanceId(instanceId);
      fetchInstanceHistory(instanceId);
      
      // Reset session tracking when switching instances
      sessionStartTime.current = Date.now();
      
      if (onInstanceChange) {
        onInstanceChange(instanceId);
      }
    }
    setMobileInstancesPanelOpen(false); // Close mobile panel on selection
  };

  // REMOVED: Load chat history on mount - WebSocket system handles this
  // REMOVED: Duplicate scroll effect - already exists above  
  // REMOVED: Duplicate audio handlers - already exists above

  // Cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      // Clean up any audio streams
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [audioStream]);

  // DISABLED: Auto-play audio for new messages to prevent double audio
  // The WebSocket TTS system (audioRef.current) handles auto-playing
  // Enhanced voice controls are for manual replay only
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && 
        lastMessage.role === "assistant" && 
        lastMessage.audioUrl && 
        lastMessage.audioTimestamp && 
        Date.now() - lastMessage.audioTimestamp < 2000) {
      console.log("🔇 [AUTO-PLAY] Skipping enhanced controls auto-play - WebSocket TTS handles this");
      // DISABLED: toggleMessageAudio(latestIndex, lastMessage.audioUrl!);
    }
  }, [messages]);

  // Function to fetch the user ID and load chat history (for non-instance mode)
  const fetchUserAndHistory = async () => {
    try {
      setIsLoadingHistory(true);
      setIsDataLoaded(false);
      
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      if (userId) {
        console.log('📜 [HISTORY] Requesting chat history for user:', userId);
        
        // Use the proper Gemini API endpoint to get chat history
        const response = await fetch('/api/gemini', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch chat history');
        }

        const data = await response.json();
        
        if (data.type === 'chat_history' && Array.isArray(data.history)) {
          const formattedHistory = data.history.map((msg: any) => ({
            role: msg.role === 'model' || msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content || '',
            type: 'text',
            isComplete: true
          })) as Message[];
          
          setMessages(formattedHistory);
          
          // Set the current instance ID if returned
          if (data.instanceId) {
            setCurrentInstanceId(data.instanceId);
          }
          
          console.log('✅ [HISTORY] Chat history loaded:', formattedHistory.length, 'messages');
        } else {
          setMessages([{ 
            role: "assistant", 
            content: "Welcome! How can I help?", 
            type: "text", 
            isComplete: true 
          }]);
          console.log('📝 [HISTORY] No history found, setting welcome message');
        }
      } else {
        setMessages([{ 
          role: "assistant", 
          content: "Welcome! How can I help?", 
          type: "text", 
          isComplete: true 
        }]);
        console.log('👤 [HISTORY] No user session, setting welcome message');
      }
      
      setIsDataLoaded(true);
    } catch (error) {
      console.error('❌ [HISTORY] Error fetching user session:', error);
      setMessages([{ 
        role: "assistant", 
        content: "Welcome! How can I help?", 
        type: "text",
        isComplete: true
      }]);
      setIsDataLoaded(true);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Clear chat history function - DIRECT DATABASE CALL
  const clearChatHistory = async () => {
    try {
      setIsClearingChat(true);
      console.log('🧹 [DIRECT-DB] Clearing chat history directly via Supabase...');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.log('No user found, skipping chat history clear');
        return;
      }

      if (!currentInstanceId) {
        console.log('No current instance, skipping chat history clear');
        return;
      }

      // Direct database call (bypass broken HTTP endpoint)
      const { error } = await supabase
        .from('chat_history')
        .update({ 
          messages: [],
          updated_at: new Date().toISOString()
        })
        .eq('id', currentInstanceId)
        .eq('user_id', session.user.id);

      if (error) {
        console.error('❌ [DIRECT-DB] Database error:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('✅ [DIRECT-DB] Successfully cleared chat history');
      setMessages([]);
      
    } catch (error) {
      console.error('❌ [DIRECT-DB] Error clearing chat history:', error);
      setError('Failed to clear chat history.');
    } finally {
      setIsClearingChat(false);
    }
  };

  // Toggle play/pause function
  const toggleAudio = () => {
    if (!audioRef.current) return;
    
    if (isAudioPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Play error:", e));
    }
  };

  // Enhanced audio control functions

  // Play/pause audio for a specific message with enhanced controls
  const toggleMessageAudio = (messageIndex: number, audioUrl: string) => {
    console.log(`🔊 [AUDIO] Toggle audio for message ${messageIndex}`);
    
    // Stop WebSocket TTS audio if it's playing
    if (audioRef.current && !audioRef.current.paused) {
      console.log("🔇 [AUDIO] Stopping WebSocket TTS audio to prevent double audio");
      audioRef.current.pause();
      setIsAudioPlaying(false);
    }
    
    // Stop any currently playing enhanced controls audio
    if (playingMessageIndex !== null && playingMessageIndex !== messageIndex) {
      stopMessageAudio(playingMessageIndex);
    }
    
    // Get or create audio element for this message
    if (!messageAudioRefs.current[messageIndex]) {
      const messageAudio = new Audio(audioUrl);
      messageAudio.volume = audioVolume; // Apply volume setting
      messageAudioRefs.current[messageIndex] = messageAudio;
      
      // Set up event listeners
      messageAudio.onplay = () => {
        console.log(`🔊 [AUDIO] Message ${messageIndex} started playing`);
        setIsAudioPlaying(true);
        setPlayingMessageIndex(messageIndex);
      };
      
      messageAudio.onpause = () => {
        console.log(`🔊 [AUDIO] Message ${messageIndex} paused`);
        setIsAudioPlaying(false);
      };
      
      messageAudio.onended = () => {
        console.log(`🔊 [AUDIO] Message ${messageIndex} finished playing`);
        setIsAudioPlaying(false);
        setPlayingMessageIndex(null);
        setAudioProgress(prev => ({ ...prev, [messageIndex]: 0 }));
      };
      
      messageAudio.onerror = (e) => {
        // Only log if it's an actual failure (not just format issues with working audio)
        if (messageAudio.error && messageAudio.readyState === 0) {
          console.warn(`🔊 [AUDIO] Message ${messageIndex} failed to load`);
        }
        setIsAudioPlaying(false);
        setPlayingMessageIndex(null);
      };
      
      messageAudio.onloadedmetadata = () => {
        setAudioDuration(prev => ({ ...prev, [messageIndex]: messageAudio.duration }));
      };
      
      messageAudio.ontimeupdate = () => {
        setAudioProgress(prev => ({ ...prev, [messageIndex]: messageAudio.currentTime }));
      };
    }
    
    const messageAudio = messageAudioRefs.current[messageIndex];
    
    // Toggle play/pause
    if (messageAudio.paused) {
      messageAudio.play().catch(e => {
        console.error(`🔊 [AUDIO] Failed to play message ${messageIndex}:`, e);
      });
    } else {
      messageAudio.pause();
    }
  };

  // Stop audio for a specific message
  const stopMessageAudio = (messageIndex: number) => {
    const messageAudio = messageAudioRefs.current[messageIndex];
    if (messageAudio) {
      messageAudio.pause();
      messageAudio.currentTime = 0;
      setAudioProgress(prev => ({ ...prev, [messageIndex]: 0 }));
    }
    if (playingMessageIndex === messageIndex) {
      setIsAudioPlaying(false);
      setPlayingMessageIndex(null);
    }
  };

  // Replay audio for a specific message
  const replayMessageAudio = (messageIndex: number, audioUrl: string) => {
    console.log(`🔊 [AUDIO] Replay audio for message ${messageIndex}`);
    
    // Stop current audio if playing
    if (playingMessageIndex !== null) {
      stopMessageAudio(playingMessageIndex);
    }
    
    // Reset progress and play from beginning
    setAudioProgress(prev => ({ ...prev, [messageIndex]: 0 }));
    
    // If audio element exists, reset and play
    if (messageAudioRefs.current[messageIndex]) {
      const messageAudio = messageAudioRefs.current[messageIndex];
      messageAudio.currentTime = 0;
      messageAudio.play().catch(e => {
        console.error(`🔊 [AUDIO] Failed to replay message ${messageIndex}:`, e);
      });
    } else {
      // Create new audio element and play
      toggleMessageAudio(messageIndex, audioUrl);
    }
  };

  // Check if a specific message is currently playing
  const isMessagePlaying = (messageIndex: number) => {
    return playingMessageIndex === messageIndex && isAudioPlaying;
  };

  // Check if a specific message is paused
  const isMessagePaused = (messageIndex: number) => {
    const messageAudio = messageAudioRefs.current[messageIndex];
    return messageAudio && messageAudio.paused && messageAudio.currentTime > 0;
  };
  
  // 🚀 CRITICAL FIX 4C: Ultra-fast Web Audio API playback
  // 🧹 OPTIMIZATION 2: Removed complex WebAudio API function (saved ~30 lines)

  // Handle sending message with optimistic UI updates
  const handleSendMessage = async () => {
    await handleSendMessageWithText();
  };

  const handleHttpMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading || !isDataLoaded) return;

    // If no instance is selected, create a new one
    if (!currentInstanceId) {
      await createNewInstance();
      if (!currentInstanceId) {
        setError("Failed to create chat instance.");
        return;
      }
    }

    // Update instance timestamp
    if (currentInstanceId) {
      updateInstanceTimestamp(currentInstanceId);
    }

    setIsLoading(true);
    setError(null);
    
    // Add user message
    const userMessage: Message = {
      role: "user",
      content: textToSend,
      type: "text",
      isComplete: true
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('No user session');
      }

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          type: 'chat',
          message: textToSend,
          instanceId: currentInstanceId,
          history: messages.map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }]
          })),
          useStreaming: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Handle non-streaming response
      const data = await response.json() as ChatResponse & { type: string; instanceId?: string };
      
      if (data.type === 'chat_response') {
        const { content, isComplete, title, instanceId } = data;
        
        // Add assistant message
        setMessages(prev => [...prev, {
          role: "assistant",
          content: content,
          type: "text",
          isComplete: isComplete
        }]);

        // Update title if provided
        if (title && onTitleUpdate) {
          onTitleUpdate(title);
        }

        // Update instance ID if needed
        if (instanceId && instanceId !== currentInstanceId) {
          setCurrentInstanceId(instanceId);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Audio recording and sending logic
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording and send audio
      console.log("🎤 Stopping voice recording");
      
      // BUGFIX: Immediately stop recording state and microphone
      setIsRecording(false);
      
      // Stop all audio tracks immediately
      if (audioStream) {
        audioStream.getTracks().forEach(track => {
          track.stop();
          console.log("🎤 Stopped audio track:", track.kind);
        });
        setAudioStream(null);
      }
      
      // Stop MediaRecorder
      if (mediaRecorder) {
        mediaRecorder.stop();
        setMediaRecorder(null);
        // MediaRecorder.onstop event will handle sending the audio
      }
    } else {
      // Start recording
      console.log("🎤 Starting voice recording");
      setIsRecording(true);
      audioChunksRef.current = [];
      
      try {
        console.log("🎤 Requesting microphone access");
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        console.log("🎤 Microphone access granted");
        setAudioStream(stream);
        
        const recorder = new MediaRecorder(stream);
        console.log("🎤 MediaRecorder created");
        setMediaRecorder(recorder);
        
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            console.log(`🎤 Audio data chunk received: ${event.data.size} bytes`);
            audioChunksRef.current.push(event.data);
          }
        };
        
        recorder.onstop = async () => {
          console.log("🎤 Recording stopped, processing audio - OPTIMIZED");
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
          console.log(`🎤 Audio blob created: ${audioBlob.size} bytes`);
          
          // OPTIMIZATION 12: Use streaming base64 conversion for better performance
          const base64Audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const dataUrl = reader.result as string;
                const commaIndex = dataUrl.indexOf(',');
                const base64 = commaIndex !== -1 ? dataUrl.substring(commaIndex + 1) : dataUrl;
                resolve(base64);
              } catch (error) {
                reject(error);
              }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(audioBlob);
          });
          
          console.log(`🎤 Audio converted to base64 (STREAMING): ${base64Audio.length} chars`);
          
          // Set loading state while waiting for response
          setIsLoading(true);
          setLastMessageWasVoice(true);
          setTtsAudioUrl(null);
          
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
              throw new Error('No user session');
            }

            // 🚀 CRITICAL FIX: Use WebSocket-only processing (eliminate duplicate HTTP calls)
            if (wsClient && wsConnected) {
              console.log("🚀 [WS] Using WebSocket for voice processing");
              setWsProcessingStatus("Processing voice with WebSocket streaming...");
              
              try {
                // 🚀 OPTIMIZATION 7: Skip connection testing for speed (trust wsConnected state)
                const chatHistory = messages.map(msg => ({
                  role: msg.role === "assistant" ? "model" : "user",
                  parts: [{ text: msg.content }]
                }));
                
                console.log("🚀 [WS] Sending voice-process event directly");
                await wsClient.processVoice(base64Audio, session.user.id, undefined, selectedAccent, selectedGender, chatHistory, currentInstanceId, true);
                console.log("✅ [WS] Voice processing started - NO HTTP fallback needed");
                
                setWsProcessingStatus(null);
                return; // 🚀 CRITICAL: WebSocket handles everything, NO HTTP processing
              } catch (wsError) {
                console.error("❌ [WS] WebSocket processing failed:", wsError);
                setWsProcessingStatus("WebSocket failed - falling back to HTTP");
                console.log("🔄 [WS] WebSocket failed, continuing to HTTP fallback");
                // Fall through to HTTP fallback
              }
            } else {
              console.log("⚠️ [HTTP FALLBACK] WebSocket not available, using HTTP");
              setWsProcessingStatus("WebSocket unavailable - using HTTP fallback");
            }

            // HTTP Fallback - ONLY when WebSocket fails or unavailable
            console.log("🎤 Sending audio to HTTP API");
            const response = await fetch('/api/gemini', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                type: 'audio',
                audio: base64Audio,
                mimeType: 'audio/wav',
                history: messages.map(msg => ({
                  role: msg.role === "assistant" ? "model" : "user",
                  parts: [{ text: msg.content }]
                })),
                generateTTS: true,
                accent: selectedAccent,
                gender: selectedGender
              })
            });

            if (!response.ok) {
              console.error(`🎤 API response not OK: ${response.status} ${response.statusText}`);
              throw new Error(`Failed to process audio: ${response.status} ${response.statusText}`);
            }

            if (!response.body) {
              console.error("🎤 No response body received");
              throw new Error('No response body');
            }

            console.log("🎤 Processing response stream - OPTIMIZED");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            // OPTIMIZATION 1: Remove UPDATE_INTERVAL throttling for faster processing
            // OPTIMIZATION 2: Pre-allocate buffer capacity and use more efficient chunk processing
            const chunks: string[] = [];

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // OPTIMIZATION 3: Decode chunks without intermediate string concatenation
              const chunk = decoder.decode(value, { stream: true });
              chunks.push(chunk);
              
              // OPTIMIZATION 4: Process accumulated chunks in batches to reduce overhead
              if (chunks.length >= 5 || done) {
                const batchData = chunks.join('');
                buffer += batchData;
                chunks.length = 0; // Clear array efficiently
              }
              
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              // OPTIMIZATION 5: Process lines immediately without storing in intermediate arrays
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (!line.trim()) continue;
                
                try {
                  const data = JSON.parse(line);
                  // 🧹 OPTIMIZATION 6: Removed excessive debug logging (was 400+ lines per request)

                    if (data.type === 'transcription') {
                      console.log("🎤 Transcription received");
                      
                      // 🔧 FIX: Only add transcription messages for actual voice input
                      // Skip transcription events that might be echoed from text input
                      if (data.data && data.data.text && data.isVoiceTranscription !== false) {
                        // Add the transcription as a user message
                        setMessages(prev => [...prev, { 
                          role: "user", 
                          content: data.data.text, 
                          type: "text", 
                          isComplete: true,
                          isVoiceMessage: true
                        }]);
                        
                        // 🎯 NEW: Set thinking status after transcription is displayed
                        setIsThinking(true);
                        console.log("🤔 [STATUS] Set thinking... (transcription complete)");
                      } else {
                        console.log("🔇 [FIX] Skipping transcription echo from text input");
                      }
                    } else if (data.type === 'stream-chunk') {
                      // 🎯 NEW: Clear thinking status when AI response starts
                      if (isThinking) {
                        setIsThinking(false);
                        console.log("💭 [STATUS] Cleared thinking... (AI response started)");
                      }
                      
                      // 🧹 OPTIMIZATION 6: Streamlined chunk processing (removed debug overhead)
                      setMessages(prev => {
                        const updated = [...prev];
                        const lastIdx = updated.length - 1;
                        if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                          updated[lastIdx] = {
                            ...updated[lastIdx],
                            content: updated[lastIdx].content + data.content
                          };
                        } else {
                          updated.push({
                            role: "assistant",
                            content: data.content,
                            type: "text",
                            isComplete: false,
                            isStreaming: true
                          });
                        }
                        return updated;
                      });
                    } else if (data.type === 'stream-complete') {
                      console.log("🏁 Stream complete");
                      setMessages(prev => {
                        const updated = [...prev];
                        const lastIdx = updated.length - 1;
                        if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                          updated[lastIdx] = {
                            ...updated[lastIdx],
                            content: data.content,
                            isComplete: true,
                            isStreaming: false
                          };
                        }
                        return updated;
                      });
                    } else if (data.type === 'tts-audio') {
                      console.log("🎤 Received TTS audio");
                      const httpStartTime = performance.now();
                      
                      // OPTIMIZATION 25A: Ultra-fast HTTP TTS processing
                      const audioUrl = `data:${data.mimeType};base64,${data.audio}`;
                      
                      // OPTIMIZATION 25B: Immediate audio setup for HTTP TTS
                      if (audioRef.current) {
                        audioRef.current.src = audioUrl;
                        audioRef.current.volume = audioVolume;
                        console.log(`🚀 [HTTP-FAST] Audio src set in ${(performance.now() - httpStartTime).toFixed(1)}ms`);
                      }
                      
                      setTtsAudioUrl(audioUrl);
                      
                      // OPTIMIZATION 27D: Non-blocking HTTP audio state update
                      startTransition(() => {
                        setMessages(prev => {
                          const updated = [...prev];
                          const lastAssistantIndex = updated.length - 1;
                          if (lastAssistantIndex >= 0 && updated[lastAssistantIndex].role === "assistant") {
                            updated[lastAssistantIndex] = {
                              ...updated[lastAssistantIndex],
                              audioUrl: audioUrl,
                              audioTimestamp: Date.now()
                            };
                            console.log('🔊 [HTTP AUDIO] Added audio URL to existing message (non-blocking)');
                          }
                          return updated;
                        });
                      });
                      
                      // OPTIMIZATION 25C: Ultra-fast HTTP audio playback
                      if (audioRef.current) {
                        const audio = audioRef.current;
                        
                        const onHttpCanPlay = () => {
                          const totalTime = performance.now() - httpStartTime;
                          console.log(`🚀 [HTTP-ULTRA-FAST] Audio ready in ${totalTime.toFixed(1)}ms`);
                          
                          audio.play().then(() => {
                            // 🎯 NEW: Clear thinking status when voice starts playing
                            setIsThinking(false);
                            console.log("🎵 [STATUS] Voice started - cleared thinking status");
                          }).catch(e => {
                            console.error("🎤 HTTP auto-play error:", e);
                          });
                          
                          audio.removeEventListener('canplay', onHttpCanPlay);
                        };
                        
                        audio.addEventListener('canplay', onHttpCanPlay, { once: true });
                        audio.load();
                      }
                      
                      // Auto-play through enhanced controls will be handled after message update
                    } else                     // 🧹 OPTIMIZATION 2: Simplified TTS handling (removed complex streaming chunks system - saved ~100 lines)
                    if (data.type === 'tts-warning' || data.type === 'tts-early-chunk' || data.type === 'tts-instant-chunk' || data.type === 'tts-smart-chunk') {
                      console.log(`🔊 [NUCLEAR TTS] ${data.type} received`);
                      
                      // 🧹 OPTIMIZATION 6: Simplified Nuclear TTS processing (removed verbose logging)
                      if (data.content) {
                        setMessages(prev => {
                          const updated = [...prev];
                          const lastIdx = updated.length - 1;
                          if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                            updated[lastIdx] = {
                              ...updated[lastIdx],
                              content: data.content,
                              isComplete: updated[lastIdx].isComplete || false,
                              isStreaming: updated[lastIdx].isStreaming !== undefined ? updated[lastIdx].isStreaming : true
                            };
                          } else {
                            updated.push({
                              role: "assistant",
                              content: data.content,
                              type: "text",
                              isComplete: false,
                              isStreaming: true
                            });
                          }
                          return updated;
                        });
                      }
                      
                      // Use browser TTS for nuclear optimization audio
                      const textToSpeak = data.fallbackText || data.audioText || data.text || data.content;
                      
                      if (textToSpeak && 'speechSynthesis' in window && isVoiceEnabled) {
                        console.log("🚀 [NUCLEAR TTS] Playing audio");
                        
                        // Cancel any existing speech to avoid overlap
                        speechSynthesis.cancel();
                        
                        const utterance = new SpeechSynthesisUtterance(textToSpeak);
                        utterance.rate = 1.1;
                        utterance.pitch = 1.0;
                        utterance.volume = 0.8;
                        
                        // 🧹 OPTIMIZATION 6: Simplified voice selection (removed verbose logging)
                        const speakWithVoice = () => {
                          const voices = speechSynthesis.getVoices();
                          const preferredVoice = voices.find(voice => 
                            voice.name.includes('Google') || 
                            voice.name.includes('Microsoft') ||
                            voice.lang.includes('en-US') ||
                            voice.lang.includes('en')
                          );
                          
                          if (preferredVoice) {
                            utterance.voice = preferredVoice;
                          }
                          
                          speechSynthesis.speak(utterance);
                          console.log("✅ [NUCLEAR TTS] Audio started");
                        };
                        
                        // If voices aren't loaded yet, wait for them
                        if (speechSynthesis.getVoices().length === 0) {
                          speechSynthesis.onvoiceschanged = () => {
                            speechSynthesis.onvoiceschanged = null;
                            speakWithVoice();
                          };
                        } else {
                          speakWithVoice();
                        }
                      } else {
                        console.warn("⚠️ [NUCLEAR TTS] No text to speak or speechSynthesis not available");
                      }
                    } else if (data.type === 'error') {
                      console.error(`🎤 Error from API: ${data.error}`);
                      if (data.details) {
                        console.error(`🎤 Error details: ${data.details}`);
                      }
                      // Don't throw error, just set error state and continue
                      setError(`Voice processing failed: ${data.error}`);
                      setIsLoading(false);
                    }
                  } catch (error) {
                    console.error('🎤 Error processing chunk:', error);
                  }
                }
              }
            } catch (error) {
              console.error("🎤 Error processing audio:", error);
              setError(error instanceof Error ? error.message : "Failed to process audio");
            } finally {
              setIsLoading(false);
            }
          
          // OPTIMIZATION 13: FileReader is now handled in the streaming promise above
          
          // BUGFIX: Skip duplicate cleanup - already handled in toggleRecording
          // The audio stream and MediaRecorder are already stopped when user clicks stop
        };
        
        console.log("🎤 Starting MediaRecorder");
        recorder.start();
      } catch (err) {
        console.error("🎤 Error starting recording:", err);
        setIsRecording(false);
        setError("Failed to record audio. Please check your microphone permissions.");
        setIsLoading(false);
      }
    }
  };

  // 🧹 OPTIMIZATION 1: Removed call mode dead code functions (saved ~50 lines)

  // Stop recording function (cancel recording)
  const stopRecording = () => {
    if (isRecording && mediaRecorder) {
      console.log("🎤 Stopping and canceling recording");
      setIsRecording(false);
      
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      }
      
      setMediaRecorder(null);
      audioChunksRef.current = [];
      voiceFeedback.setState('idle');
    }
  };

  // Submit recording function (process and send recording)
  const submitRecording = () => {
    if (isRecording && mediaRecorder) {
      console.log("🎤 Submitting recording");
      
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      
      // The recording will be processed in the onstop event handler
      // which is already set up in toggleRecording
    }
  };

  // Helper function to check if user can star more chats
  const canStarMoreChats = (starredChats: ChatInstance[]): boolean => {
    return starredChats.length < 5; // Max 5 starred chats
  };

  // 🎯 NEW: Star/Unstar functionality
  const handleStarToggle = async (instanceId: string, isCurrentlyStarred: boolean) => {
    try {
      setStarringInstance(instanceId);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('Please sign in to star chats');
        return;
      }

      // Check if user can star more chats (when starring)
      if (!isCurrentlyStarred) {
        const starredChats = chatInstances.filter(chat => chat.is_starred);
        if (!canStarMoreChats(starredChats)) {
          toast.error('Maximum 5 starred chats allowed. Please unstar a chat first.');
          return;
        }
      }

      const action = isCurrentlyStarred ? 'unstar' : 'star';
      
      const response = await fetch('/api/gemini', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action,
          instanceId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} chat`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Update local state
        setChatInstances(prev => 
          prev.map(instance => 
            instance.id === instanceId 
              ? { ...instance, is_starred: !isCurrentlyStarred }
              : instance
          )
        );
        
        toast.success(isCurrentlyStarred ? 'Chat unstarred' : 'Chat starred');
      } else {
        throw new Error(data.error || `Failed to ${action} chat`);
      }
    } catch (error) {
      console.error('Error toggling star:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update star status');
    } finally {
      setStarringInstance(null);
    }
  };

  // 🎯 NEW: Function to update instance timestamp when messages are sent
  const updateInstanceTimestamp = async (instanceId: string) => {
    try {
      const { error } = await supabase
        .from('chat_history')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', instanceId);
      if (error) throw error;
      
      // Move updated instance to the top of its group
      setChatInstances(prev => {
        const instanceToMove = prev.find(i => i.id === instanceId);
        if (!instanceToMove) return prev;
        
        const otherInstances = prev.filter(i => i.id !== instanceId);
        return [instanceToMove, ...otherInstances];
      });

    } catch (error) {
      console.error("Error updating instance timestamp:", error);
    }
  };

  const groupedChats = useMemo(() => {
    if (!chatInstances) {
      return { today: [], yesterday: [], thisWeek: [], thisMonth: [], older: [] };
    }
    return groupChatsByTime(chatInstances);
  }, [chatInstances]);

  const timeGroupsForDisplay = useMemo(() => {
    const groups = [
      { key: 'today', label: 'Today', chats: groupedChats.today },
      { key: 'yesterday', label: 'Yesterday', chats: groupedChats.yesterday },
      { key: 'thisWeek', label: 'This Week', chats: groupedChats.thisWeek },
      { key: 'thisMonth', label: 'This Month', chats: groupedChats.thisMonth },
      { key: 'older', label: 'Older', chats: groupedChats.older }
    ];
    return groups.filter(group => group.chats.length > 0);
  }, [groupedChats]);

  const renderInstanceItem = (instance: ChatInstance) => {
    const isEditing = editingInstanceId === instance.id;
    const isSelected = currentInstanceId === instance.id;

    return (
      <div
        key={instance.id}
        className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors duration-200 ${
          isSelected ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
        onClick={() => !isEditing && handleInstanceSelect(instance.id)}
      >
        {isEditing ? (
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={() => handleTitleSave(instance.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave(instance.id);
                if (e.key === 'Escape') {
                  setEditingInstanceId(null);
                  setEditingTitle("");
                }
              }}
              className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-sm"
              autoFocus
            />
          </div>
        ) : (
          <>
            <MessageSquare className="h-4 w-4 mr-3 text-gray-500" />
            <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate pr-2">
              {instance.title}
            </span>
            <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {
                e.stopPropagation();
                setEditingInstanceId(instance.id);
                setEditingTitle(instance.title);
              }}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {
                e.stopPropagation();
                deleteInstance(instance.id);
              }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Chat History</h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => createNewInstance()}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>

          <div className="space-y-4">
            {timeGroupsForDisplay.map(group => (
              <div key={group.key}>
                <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  {group.label}
                </h3>
                <div className="space-y-1">
                  {group.chats.map(renderInstanceItem)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );

  const handleWebSocketMessage = async (data: WebSocketResponse) => {
    if (data.type === "stream-chunk") {
      // Handle streaming chunks
      const { content, isComplete } = data;
      
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage && lastMessage.role === "assistant" && !lastMessage.isComplete) {
              // Update existing incomplete message
              const updatedMessages = [...prev];
              updatedMessages[prev.length - 1] = {
                ...lastMessage,
            content: lastMessage.content + content,
            isComplete: isComplete
              };
              return updatedMessages;
            } else {
              // Create new message
              return [...prev, {
                role: "assistant",
                content: content,
            type: "text",
            isComplete: isComplete
              }];
            }
          });
        }
    else if (data.type === "stream-complete") {
      // Handle completion
      const { content, isComplete, instanceId } = data;
      
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === "assistant" && !lastMessage.isComplete) {
          // Update existing message
          const updatedMessages = [...prev];
          updatedMessages[prev.length - 1] = {
            ...lastMessage,
            content: content,
            isComplete: true
          };
          return updatedMessages;
        }
        return prev;
      });

      // Update instance if needed
      if (instanceId && instanceId !== currentInstanceId) {
        setCurrentInstanceId(instanceId);
        if (onInstanceChange) {
          onInstanceChange(instanceId);
        }
      }
      
      setIsLoading(false);
    }
    else if (data.type === "title-update") {
      // Handle title update
      const { newTitle } = data;
      if (newTitle && onTitleUpdate) {
        onTitleUpdate(newTitle);
      }
    }
    else if (data.type === "error") {
      console.error("Error from WebSocket:", data.error);
      setError(data.error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-70px)] overflow-hidden bg-gradient-to-br from-white to-gray-50 mx-auto w-full">
      {/* Mobile Instances Panel - Overlay */}
      {isMediumScreen && !hideInstanceSidebar && (
        <>
          <div 
            className={`fixed top-0 left-0 h-full w-[calc(100%-50px)] max-w-xs bg-white/95 backdrop-blur-sm z-40 shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${
              mobileInstancesPanelOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="p-3 border-b sticky top-0 bg-white/90 backdrop-blur-sm z-10">
              {/* Mobile Header */}
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { createNewInstance(); setMobileInstancesPanelOpen(false); }}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4" />
                  New Chat
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileInstancesPanelOpen(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Mobile Voice Settings */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Volume2 className="h-4 w-4" />
                  <span>Voice Settings</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-12">Gender:</span>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    {(['female', 'male'] as const).map((gender) => (
                      <Button
                        key={gender}
                        variant={selectedGender === gender ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSelectedGender(gender)}
                        className={`h-6 px-2 text-xs font-medium capitalize ${
                          selectedGender === gender 
                            ? "bg-blue-600 text-white hover:bg-blue-700" 
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                        }`}
                      >
                        {gender}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Chat instances list */}
            <ScrollArea className="flex-1 p-3">
              {isLoadingInstances ? (
                <div className="text-center text-sm text-gray-500 py-8">
                  Loading conversations...
                </div>
              ) : chatInstances.length === 0 ? (
                <div className="text-center text-sm text-gray-500 py-8">
                  No conversations yet.<br />Start your first chat!
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 🎯 NEW: Claude-style Starred and Recents sections */}
                  {(() => {
                    const groupedChats = groupChatsByTime(chatInstances);
                    const timeGroups = getTimeGroupsForDisplay(groupedChats);
                    
                    return (
                      <>
                        {/* Starred Section */}
                        {groupedChats.starred.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">
                              ⭐ Starred {getStarredCountDisplay(groupedChats.starred)}
                            </div>
                            <div className="space-y-1">
                              {groupedChats.starred.map((instance) => (
                                <div
                                  key={instance.id}
                                  className={`group relative flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                    currentInstanceId === instance.id
                                      ? "bg-blue-50 border border-blue-200"
                                      : "bg-gray-50 hover:bg-gray-100 border border-transparent"
                                  }`}
                                  onClick={() => {
                                    handleInstanceSelect(instance.id);
                                    setMobileInstancesPanelOpen(false);
                                  }}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate pr-2">
                                      {instance.title}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStarToggle(instance.id, true);
                                      }}
                                      disabled={starringInstance === instance.id}
                                      className="h-6 w-6 text-yellow-500 hover:text-yellow-600"
                                    >
                                      <Star className="h-3 w-3 fill-current" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recents Section */}
                        {timeGroups.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">
                              📅 Recents
                            </div>
                            <div className="space-y-3">
                              {timeGroups.map((group) => (
                                <div key={group.key}>
                                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1 px-1">
                                    {group.label}
                                  </div>
                                  <div className="space-y-1">
                                    {group.chats.map((instance) => (
                                      <div
                                        key={instance.id}
                                        className={`group relative flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                          currentInstanceId === instance.id
                                            ? "bg-blue-50 border border-blue-200"
                                            : "bg-gray-50 hover:bg-gray-100 border border-transparent"
                                        }`}
                                        onClick={() => {
                                          handleInstanceSelect(instance.id);
                                          setMobileInstancesPanelOpen(false);
                                        }}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium text-gray-900 truncate pr-2">
                                            {instance.title}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStarToggle(instance.id, false);
                                            }}
                                            disabled={starringInstance === instance.id}
                                            className="h-6 w-6 text-gray-400 hover:text-yellow-500"
                                          >
                                            <Star className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </ScrollArea>
          </div>
        </>
      )}

      {/* Mobile backdrop overlay */}
      {isMediumScreen && !hideInstanceSidebar && mobileInstancesPanelOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30" 
          onClick={() => setMobileInstancesPanelOpen(false)}
        />
      )}

      {/* Desktop Instances Panel */}
      {!isMediumScreen && !hideInstanceSidebar && (
        <div className={`${showInstanceSidebar ? 'w-72' : 'w-0'} transition-all duration-300 ease-in-out overflow-hidden bg-white border-r border-gray-200 flex flex-col`}>
          <div className="p-4 border-b flex items-center justify-between bg-gray-50">
            <Button
              variant="ghost"
              size="sm" 
              onClick={() => createNewInstance()}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowInstanceSidebar(!showInstanceSidebar)}
              className="h-8 w-8"
            >
              <Sidebar className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Desktop chat instances list */}
          <ScrollArea className="flex-1 p-4">
            {isLoadingInstances ? (
              <div className="text-center text-sm text-gray-500 py-8">
                Loading conversations...
              </div>
            ) : chatInstances.length === 0 ? (
              <div className="text-center text-sm text-gray-500 py-8">
                No conversations yet.<br />Start your first chat!
              </div>
            ) : (
              <div className="space-y-6">
                {timeGroupsForDisplay.map((group) => (
                  <div key={group.key}>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 px-1">
                      {group.label}
                    </div>
                    <div className="space-y-2">
                      {group.chats.map(renderInstanceItem)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        {showHeader && (
          <div className="p-4 border-b bg-white">
            <div className="flex items-center justify-between flex-wrap gap-3">
              {/* Left side - Navigation and Title */}
              <div className="flex items-center gap-3">
                {/* Mobile menu button */}
                {isMediumScreen && !hideInstanceSidebar && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileInstancesPanelOpen(true)}
                    className="h-8 w-8"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                )}
                
                {/* Desktop sidebar toggle */}
                {!isMediumScreen && !hideInstanceSidebar && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowInstanceSidebar(!showInstanceSidebar)}
                    className="h-8 w-8"
                  >
                    <Sidebar className="h-4 w-4" />
                  </Button>
                )}
                
                <h1 className="text-xl font-semibold text-gray-900">AI Assistant</h1>
              </div>
              
              {/* Right side - Voice Settings and Actions */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Voice Settings */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 hidden sm:inline">Voice:</span>
                  


                  {/* Gender Selection */}
                  {isVoiceEnabled && (
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                      {(['female', 'male'] as const).map((gender) => (
                        <Button
                          key={gender}
                          variant={selectedGender === gender ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setSelectedGender(gender)}
                          className={`h-7 px-2 text-xs font-medium capitalize ${
                            selectedGender === gender 
                              ? "bg-blue-600 text-white hover:bg-blue-700" 
                              : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                          }`}
                          title={`${gender} voice`}
                        >
                          {gender}
                        </Button>
                      ))}
                    </div>
                  )}
                  


                  {/* Connection Status Indicator */}
                  <div className="flex items-center gap-1 text-xs">
                    <div className={`flex items-center gap-1 ${wsConnected ? 'text-blue-600' : 'text-gray-400'}`}>
                      <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <span>{wsConnected ? 'WebSocket' : 'HTTP'}</span>
                    </div>
                  </div>
                  
                  {/* Text-only mode indicator */}
                  {!isVoiceEnabled && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <span>Text Only</span>
                    </div>
                  )}
                </div>
                
                {/* Desktop New Chat button */}
                {!isMediumScreen && !hideInstanceSidebar && !showInstanceSidebar && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => createNewInstance()}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    New Chat
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="p-4 space-y-6 chat-messages-container">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"} w-full max-w-[85%] sm:max-w-[90%]`}>
                    <div className={`rounded-2xl px-5 py-3 flex flex-col ${
                      message.role === "user"
                        ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20"
                        : "bg-white text-gray-800 border border-gray-200"
                    }`}>
                      <div className="w-full">
                        {message.role === "assistant" ? (
                          <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-h1:text-xl prose-h1:font-bold prose-h1:mb-4 prose-h1:mt-6 prose-h2:text-lg prose-h2:font-semibold prose-h2:mb-3 prose-h2:mt-5 prose-h3:text-base prose-h3:font-medium prose-h3:mb-2 prose-h3:mt-4 prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4 prose-strong:text-gray-800 prose-strong:font-semibold prose-em:text-gray-600 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:rounded prose-code:text-sm prose-ul:space-y-2 prose-ol:space-y-2 prose-li:text-gray-700 prose-li:leading-relaxed prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600">
                        <ReactMarkdown
                          components={{
                            h1: ({children}) => <h1 className="text-xl font-bold text-gray-800 mb-4 mt-6 border-b border-gray-200 pb-2">{children}</h1>,
                            h2: ({children}) => <h2 className="text-lg font-semibold text-gray-800 mb-3 mt-5 flex items-center gap-2">{children}</h2>,
                            h3: ({children}) => <h3 className="text-base font-medium text-gray-800 mb-2 mt-4">{children}</h3>,
                            p: ({children}) => <p className="text-gray-700 leading-relaxed mb-4 last:mb-0">{children}</p>,
                            a: ({children, href}) => <a href={href} className="text-blue-600 hover:text-blue-800 underline underline-offset-2 decoration-blue-300 hover:decoration-blue-500 transition-colors">{children}</a>,
                            ul: ({children}) => <ul className="space-y-2 mb-4">{children}</ul>,
                            ol: ({children}) => <ol className="space-y-2 mb-4 list-decimal ml-4 pl-2">{children}</ol>,
                            li: ({children}) => <li className="text-gray-700 leading-relaxed">{children}</li>,
                            strong: ({children}) => <strong className="font-semibold text-gray-800">{children}</strong>,
                            em: ({children}) => <em className="italic text-gray-600">{children}</em>,
                            code: ({children}) => <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
                            blockquote: ({children}) => <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 my-4">{children}</blockquote>,
                            'ul > li': ({children}) => (
                              <li className="text-gray-700 leading-relaxed pl-2 relative">
                                <span className="absolute left-0 top-1 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                <span className="pl-4">{children}</span>
                              </li>
                            ),
                            'ol > li': ({children}) => (
                              <li className="text-gray-700 leading-relaxed">{children}</li>
                            )
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm sm:text-base leading-relaxed">{message.content}</p>
                        )}
                      </div>
                      
                      {message.role === "assistant" && index === messages.length - 1 && message.audioTimestamp && message.audioTimestamp > sessionStartTime.current && (
                        <>
                          {!message.audioUrl && (
                            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                              <div className="flex items-center gap-1 text-xs text-gray-400">
                                <Volume2 className="h-3 w-3" />
                                <span>Audio processing...</span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      {message.role === "assistant" && message.audioUrl && index === messages.length - 1 && message.audioTimestamp && message.audioTimestamp > sessionStartTime.current && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <EnhancedVoiceControls
                            messageId={`message-${index}`}
                            audioUrl={message.audioUrl}
                            text={message.content}
                            accent={selectedAccent}
                            gender={selectedGender}
                            service="deepgram"
                            className="w-full"
                            showProgressBar={true}
                            showVolumeControl={true}
                            showDownloadButton={true}
                            sharedAudioRef={audioRef}
                            onPlayStart={() => console.log(`🎵 Playing message ${index}`)}
                            onPlayEnd={() => console.log(`🎵 Finished playing message ${index}`)}
                            onError={(error) => console.error(`❌ Audio error for message ${index}:`, error)}
                            onDownload={() => console.log(`📥 Downloaded audio for message ${index}`)}
                          />
                        </div>
                      )}
                      
                      {message.role === "assistant" && !message.audioUrl && isVoiceEnabled && message.isVoiceMessage && index === messages.length - 1 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <EnhancedVoiceControls
                            messageId={`message-fallback-${index}`}
                            text={message.content}
                            accent={selectedAccent}
                            gender={selectedGender}
                            service="browser"
                            useBrowserTTS={true}
                            className="w-full"
                            showProgressBar={false}
                            showVolumeControl={true}
                            showStopButton={true}
                            showDownloadButton={false}
                            onPlayStart={() => console.log(`🌐 Playing Browser TTS for message ${index}`)}
                            onPlayEnd={() => console.log(`🌐 Finished Browser TTS for message ${index}`)}
                            onError={(error) => console.error(`❌ Browser TTS error for message ${index}:`, error)}
                            onDownload={() => console.log(`📥 Browser TTS download attempted for message ${index}`)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>



        {/* Input Area */}
        <div className="p-4 border-t bg-white">
          <div className="flex flex-col gap-3">
            {/* Voice feedback indicator */}
            <SubtleVoiceIndicator
              state={voiceFeedback.state}
              errorType={voiceFeedback.errorType}
              errorMessage={voiceFeedback.errorMessage}
              processingText={voiceFeedback.processingText}
              onRetry={() => {
                voiceFeedback.clearError();
                setError(null);
                if (voiceFeedback.errorType === 'microphone-permission') {
                  toggleRecording(); // Retry microphone access
                }
              }}
              onDismiss={() => {
                voiceFeedback.clearError();
                setError(null);
              }}
              className="mb-2"
            />
            
            {/* 🎯 NEW: Voice Message Status Indicators */}
            {isThinking && (
              <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
                <span>thinking...</span>
              </div>
            )}
            
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Button variant="ghost" size="icon" onClick={toggleRecording} disabled={isLoading || !isDataLoaded} className={`rounded-full ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white' : wsConnected ? 'bg-green-50 border border-green-200' : ''}`}>
                {isRecording ? ( <div className="h-4 w-4 rounded-full bg-white animate-pulse" /> ) : ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mic"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>)}
              </Button>
              <div className="flex-1 relative">
                <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage();}}} placeholder={isLoadingHistory ? "Loading data..." : "Type your message..."} className="w-full px-3 py-2 sm:px-4 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[15px] sm:text-base" disabled={isLoading || !isDataLoaded} />
                {isLoading && ( <div className="absolute right-4 top-1/2 -translate-y-1/2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div></div>)}
              </div>
              <Button variant="ghost" size="icon" onClick={handleSendMessage} disabled={!inputText.trim() || isLoading || !isDataLoaded} className="rounded-full">
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {isLoadingHistory && ( <div className="text-center text-sm text-gray-500 mt-2"> Loading conversation and user data... Please wait. </div>)}
      <audio 
        ref={audioRef} 
        src={ttsAudioUrl || undefined} 
        className="hidden" 
        controls={false} 
        onEnded={() => {
          console.log('🔊 [AUDIO] Playback ended');
          setIsAudioPlaying(false);
        }} 
        onPlay={() => {
          console.log('🔊 [AUDIO] Playback started');
          setIsAudioPlaying(true);
        }} 
        onPause={() => {
          console.log('🔊 [AUDIO] Playback paused');
          setIsAudioPlaying(false);
        }} 
        onLoadedData={() => {
          console.log('🔊 [AUDIO] Audio data loaded successfully');
          console.log('🔊 [AUDIO] Duration:', audioRef.current?.duration);
          console.log('🔊 [AUDIO] Ready state:', audioRef.current?.readyState);
        }}
        onError={(e) => {
          // Only log actual errors if audio is not playing successfully
          if (audioRef.current && audioRef.current.paused && audioRef.current.readyState === 0) {
            console.warn('🔊 [AUDIO] Playback error:', audioRef.current.error?.message);
          }
        }}
        onLoadStart={() => console.log('🔊 [AUDIO] Load started')}
        onCanPlay={() => console.log('🔊 [AUDIO] Can play')}
      />
    </div>
  );
}

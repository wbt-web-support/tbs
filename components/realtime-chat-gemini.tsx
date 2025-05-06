"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Play, Pause, Phone, PhoneOff } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AudioVisualizer } from "./audio-visualizer";

interface Message {
  role: "user" | "assistant";
  content: string;
  type: "text";
  isComplete?: boolean;
  isStreaming?: boolean;
  isVoiceMessage?: boolean;
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

export function RealtimeChatGemini() {
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
  const [audioPlaceholder, setAudioPlaceholder] = useState<null | { role: 'user' | 'assistant', id: string }>(null);
  const [showBotTyping, setShowBotTyping] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [lastMessageWasVoice, setLastMessageWasVoice] = useState(false);
  const [isInCallMode, setIsInCallMode] = useState(false);
  const [isSilent, setIsSilent] = useState(false);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processingCooldownRef = useRef<boolean>(false);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioDataRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const silenceStartTimeRef = useRef<number | null>(null);
  const continuousAudioChunksRef = useRef<Blob[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  const supabase = createClient();

  // Load chat history on mount
  useEffect(() => {
    fetchUserAndHistory();
  }, []);

  // Effect to automatically scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add effect to handle audio element events with better logging and state management
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
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
      // If component unmounts while in call mode, stop it
      if (isInCallMode) {
        stopCallMode();
      }
      
      // Also clean up any audio streams
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isInCallMode, audioStream]);

  // Function to fetch the user ID and load chat history
  const fetchUserAndHistory = async () => {
    try {
      setIsLoadingHistory(true);
      setIsDataLoaded(false);
      
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      if (userId) {
        console.log('Requesting chat history for user:', userId);
        
        const response = await fetch('/api/gemini', {
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
          console.log('Chat history loaded:', formattedHistory.length, 'messages');
        } else {
          setMessages([{ 
            role: "assistant", 
            content: "Welcome! How can I help?", 
            type: "text", 
            isComplete: true 
          }]);
        }
      } else {
        setMessages([{ 
          role: "assistant", 
          content: "Welcome! How can I help?", 
          type: "text", 
          isComplete: true 
        }]);
      }
      
      setIsDataLoaded(true);
    } catch (error) {
      console.error('Error fetching user session:', error);
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

  // Clear chat history function
  const clearChatHistory = async () => {
    try {
      setIsClearingChat(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        console.log('No user found, skipping chat history clear');
        setIsClearingChat(false);
        return;
      }

      const response = await fetch('/api/gemini', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to clear chat history');
      }

      const data = await response.json();
      
      if (data.type === 'history_cleared' && data.success) {
        setMessages([{ 
          role: "assistant", 
          content: "Welcome! How can I help?", 
          type: "text", 
          isComplete: true 
        }]);
      } else {
        throw new Error('Failed to clear chat history');
      }
    } catch (error) {
      console.error('Error clearing chat history:', error);
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

  // Handle sending message with optimistic UI updates
  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || !isDataLoaded) return;

    // Reset the current streaming message
    currentStreamingMessageRef.current = '';

    // Set a timeout to limit waiting time for response
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setError("Response took too long. Please try again.");
      }
    }, 10000); // 10 seconds max wait

    setIsLoading(true);
    setError(null);
    const currentInput = inputText;
    setInputText(""); // Clear input immediately

    const userMessage: Message = {
      role: "user",
      content: currentInput,
      type: "text",
      isComplete: true
    };
    const messagesWithUser = [...messages, userMessage];
    setMessages(messagesWithUser);

    // Show typing indicator
    setShowBotTyping(true);

    // Scroll to show the user's message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('No user session');
      }

      // Update lastMessageWasVoice state - text messages are not voice
      setLastMessageWasVoice(false);

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          type: 'chat',
          message: currentInput,
          history: messages.map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }]
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Hide typing indicator
      setShowBotTyping(false);

      // Add assistant message placeholder
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "",
        type: "text",
        isComplete: false,
        isStreaming: true
      }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastUpdate = Date.now();
      const UPDATE_INTERVAL = 50; // Update UI every 50ms

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        buffer += chunk;
        
        // Process complete JSON objects
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.type === 'stream-chunk') {
              currentStreamingMessageRef.current += data.content;
              
              // Throttle UI updates to every 50ms
              const now = Date.now();
              if (now - lastUpdate >= UPDATE_INTERVAL) {
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: currentStreamingMessageRef.current
                    };
                  }
                  return updated;
                });
                lastUpdate = now;
              }
            } else if (data.type === 'stream-complete') {
              // Always update on completion
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
              const audioUrl = `data:${data.mimeType};base64,${data.audio}`;
              console.log("Received TTS audio for voice message response", audioUrl.substring(0, 50) + "...");
              setTtsAudioUrl(audioUrl);
              
              if (audioRef.current) {
                console.log("Setting audio source and preparing to play");
                audioRef.current.src = audioUrl;
                audioRef.current.oncanplay = () => {
                  console.log("Audio can play now, auto-playing");
                  audioRef.current?.play().catch(e => {
                    console.error("Auto-play error:", e);
                    // Audio playback might be blocked by browser policy, show a message or indicator
                  });
                };
              }
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          } catch (error) {
            console.error('Error processing chunk:', error);
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setError(error instanceof Error ? error.message : "Failed to send message");
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I encountered an error.", 
        type: "text",
        isComplete: true
      }]);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  // Audio recording and sending logic
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording and send audio
      if (mediaRecorder) {
        console.log("🎤 Stopping voice recording");
        mediaRecorder.stop();
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
          console.log("🎤 Recording stopped, processing audio");
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
          console.log(`🎤 Audio blob created: ${audioBlob.size} bytes`);
          const reader = new FileReader();
          
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(",")[1];
            console.log(`🎤 Audio converted to base64: ${base64Audio.length} chars`);
            
            // Set loading state while waiting for response
            setIsLoading(true);
            
            // Show typing indicator for bot response
            setShowBotTyping(true);
            
            try {
              console.log("🎤 Sending audio to API");
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.user) {
                throw new Error('No user session');
              }

              // Set that this is a voice message and clear any previous audio URL
              setLastMessageWasVoice(true);
              setTtsAudioUrl(null);

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
                  generateTTS: true // Explicitly request TTS for voice response
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

              console.log("🎤 Processing response stream");
              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let buffer = '';
              let lastUpdate = Date.now();
              const UPDATE_INTERVAL = 50;

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                buffer += chunk;
                
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  try {
                    const data = JSON.parse(line);
                    console.log(`🎤 Received data type: ${data.type}`);

                    if (data.type === 'transcription') {
                      console.log(`🎤 Transcription: ${data.content.substring(0, 50)}...`);
                      // Add the transcription as a user message
                      setMessages(prev => [...prev, { 
                        role: "user", 
                        content: data.content, 
                        type: "text", 
                        isComplete: true,
                        isVoiceMessage: true
                      }]);
                    } else if (data.type === 'stream-chunk') {
                      // Hide typing indicator when we get the first chunk
                      setShowBotTyping(false);
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
                      console.log("🎤 Stream complete");
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
                      const audioUrl = `data:${data.mimeType};base64,${data.audio}`;
                      setTtsAudioUrl(audioUrl);
                      
                      if (audioRef.current) {
                        console.log("🎤 Setting audio source and preparing to play");
                        audioRef.current.src = audioUrl;
                        audioRef.current.oncanplay = () => {
                          console.log("🎤 Audio ready, auto-playing");
                          audioRef.current?.play().catch(e => {
                            console.error("🎤 Auto-play error:", e);
                            // Audio playback might be blocked by browser policy, show a message or indicator
                          });
                        };
                      }
                    } else if (data.type === 'error') {
                      console.error(`🎤 Error from API: ${data.error}`);
                      throw new Error(data.error);
                    }
                  } catch (error) {
                    console.error('🎤 Error processing chunk:', error);
                  }
                }
              }
            } catch (error) {
              console.error("🎤 Error processing audio:", error);
              setError(error instanceof Error ? error.message : "Failed to process audio");
              setMessages(prev => [...prev, { 
                role: "assistant", 
                content: "Sorry, I encountered an error processing your audio.", 
                type: "text",
                isComplete: true
              }]);
            } finally {
              setIsLoading(false);
              setShowBotTyping(false);
            }
          };
          
          reader.readAsDataURL(audioBlob);
          
          // Stop all tracks in the stream
          stream.getTracks().forEach(track => track.stop());
          setAudioStream(null);
          setMediaRecorder(null);
          setIsRecording(false);
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

  // Function to handle starting/stopping call mode
  const toggleCallMode = async () => {
    if (isInCallMode) {
      // End call mode
      stopCallMode();
    } else {
      // Start call mode
      startCallMode();
    }
  };
  
  // Start call mode with continuous listening
  const startCallMode = async () => {
    try {
      console.log("📱 Call mode: Starting call mode");
      
      // Request audio permission with optimal voice settings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log("📱 Call mode: Audio permission granted");
      setAudioStream(stream);
      setIsInCallMode(true);
      
      // Create audio context and analyser for voice activity detection
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      // Configure for better voice detection
      analyser.fftSize = 1024; // More detailed frequency data
      analyser.smoothingTimeConstant = 0.8; // Smoother transitions
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      console.log(`📱 Call mode: Audio analyzer set up with buffer length ${bufferLength}`);
      audioAnalyserRef.current = analyser;
      audioDataRef.current = dataArray;
      
      // Reset continuous audio chunks
      continuousAudioChunksRef.current = [];
      
      // Start recording with safe fallback
      let recorder: MediaRecorder;
      try {
        // Try with higher quality options first
        recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        console.log("📱 Call mode: Using high quality audio recorder");
      } catch (err) {
        // Fall back to default options
        console.log("📱 Call mode: Falling back to default recorder");
        recorder = new MediaRecorder(stream);
      }
      
      setMediaRecorder(recorder);
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          continuousAudioChunksRef.current.push(event.data);
        }
      };
      
      // Start detecting voice activity
      detectVoiceActivity();
      
      // Start recording in smaller chunks for more responsive sending
      console.log("📱 Call mode: Starting MediaRecorder");
      recorder.start(1000); // Collect data every second
      
      console.log("📱 Call mode: Now active and listening for voice");
    } catch (err) {
      console.error("📱 Call mode: Error starting", err);
      setError("Could not access microphone. Please check your permissions.");
      setIsInCallMode(false);
    }
  };
  
  // Stop call mode with improved cleanup
  const stopCallMode = () => {
    console.log("Stopping call mode...");
    
    // Clear animation frame
    if (animationFrameRef.current) {
      console.log("Canceling animation frame");
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Clear silence timeout
    if (silenceTimeoutRef.current) {
      console.log("Clearing silence timeout");
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    // Stop media recorder
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      console.log("Stopping media recorder");
      mediaRecorder.stop();
    }
    
    // Stop all tracks in the stream
    if (audioStream) {
      console.log("Stopping audio stream tracks");
      audioStream.getTracks().forEach(track => {
        console.log(`Stopping track: ${track.kind}`);
        track.stop();
      });
    }
    
    // Reset all call-related state
    setAudioStream(null);
    setMediaRecorder(null);
    setIsInCallMode(false);
    setIsSilent(false);
    silenceStartTimeRef.current = null;
    processingCooldownRef.current = false;
    continuousAudioChunksRef.current = [];
    
    console.log("Call mode stopped completely");
  };
  
  // Detect voice activity with improved sensitivity and logging
  const detectVoiceActivity = () => {
    if (!audioAnalyserRef.current || !audioDataRef.current || !isInCallMode) return;
    
    const analyser = audioAnalyserRef.current;
    const dataArray = audioDataRef.current;
    
    // Track consecutive frames with/without voice
    let consecutiveSilentFrames = 0;
    let consecutiveVoiceFrames = 0;
    const silenceThreshold = 20; // Adjust based on testing
    const minConsecutiveSilentFrames = 45; // About 0.75 seconds at 60fps
    const minConsecutiveVoiceFrames = 6; // About 0.1 seconds at 60fps
    
    const checkVoiceActivity = () => {
      // Skip voice detection while audio is playing to avoid false silence detection
      if (isAudioPlaying) {
        animationFrameRef.current = requestAnimationFrame(checkVoiceActivity);
        return;
      }
      
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average frequency value
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Debug every 60 frames (about once per second)
      if (Math.random() < 0.02) {
        console.log(`📊 Call mode: Audio level ${average.toFixed(1)}, silence threshold ${silenceThreshold}`);
      }
      
      const isSpeaking = average > silenceThreshold;
      
      if (isSpeaking) {
        // Count consecutive voice frames
        consecutiveVoiceFrames++;
        consecutiveSilentFrames = 0;
        
        // Only consider as speaking after enough consecutive voice frames
        // This prevents processing on brief noise spikes
        if (consecutiveVoiceFrames >= minConsecutiveVoiceFrames && isSilent) {
          console.log("🔊 Call mode: Voice detected - resumed speaking");
          setIsSilent(false);
          
          // Reset silence timers
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }
          silenceStartTimeRef.current = null;
        }
      } else {
        // Count consecutive silent frames
        consecutiveSilentFrames++;
        consecutiveVoiceFrames = 0;
        
        // Only consider as silent after enough consecutive silent frames
        if (consecutiveSilentFrames >= minConsecutiveSilentFrames && !isSilent && !silenceStartTimeRef.current) {
          console.log("🔇 Call mode: Silence detected for sustained period");
          setIsSilent(true);
          silenceStartTimeRef.current = Date.now();
          
          // Schedule processing after a brief additional confirmation delay
          if (!silenceTimeoutRef.current && !processingCooldownRef.current) {
            console.log("🔄 Call mode: Scheduling audio processing");
            silenceTimeoutRef.current = setTimeout(() => {
              if (isInCallMode && !isLoading && !isAudioPlaying) {
                console.log("🔄 Call mode: Processing audio after silence confirmation");
                processCallAudio();
              }
              silenceTimeoutRef.current = null;
            }, 700); // Additional delay for confirmation
          }
        }
      }
      
      // Continue checking
      animationFrameRef.current = requestAnimationFrame(checkVoiceActivity);
    };
    
    console.log("🎙️ Call mode: Starting voice activity detection");
    // Start voice activity detection loop
    animationFrameRef.current = requestAnimationFrame(checkVoiceActivity);
  };
  
  // Process and send call audio with cooldown
  const processCallAudio = async () => {
    // Don't process if we're in cooldown, loading, playing audio, or have no audio chunks
    if (
      processingCooldownRef.current ||
      continuousAudioChunksRef.current.length === 0 || 
      isLoading || 
      isAudioPlaying
    ) return;
    
    // Check if the audio chunks are actually containing data (not just empty audio)
    const totalSize = continuousAudioChunksRef.current.reduce((size, chunk) => size + chunk.size, 0);
    if (totalSize < 1000) { // Skip if less than 1KB of audio data
      console.log("Skipping processing - audio chunks too small:", totalSize, "bytes");
      continuousAudioChunksRef.current = []; // Clear the small chunks
      return;
    }
    
    console.log("Processing call audio chunks:", continuousAudioChunksRef.current.length, "total size:", totalSize, "bytes");
    
    try {
      // Set cooldown to prevent rapid consecutive processing
      processingCooldownRef.current = true;
      
      // After 2 seconds, reset the cooldown
      setTimeout(() => {
        processingCooldownRef.current = false;
      }, 2000);
      
      // Create a blob from accumulated chunks
      const audioBlob = new Blob(continuousAudioChunksRef.current, { type: "audio/wav" });
      
      // Reset for next utterance
      continuousAudioChunksRef.current = [];
      
      // Process the audio blob
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(",")[1];
        
        setIsLoading(true);
        setLastMessageWasVoice(true);
        setTtsAudioUrl(null);
        setShowBotTyping(true);
        
        try {
          console.log("📢 Call mode: Sending audio for processing");
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
              type: 'audio',
              audio: base64Audio,
              mimeType: 'audio/wav',
              history: messages.map(msg => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }]
              })),
              generateTTS: true // Explicitly request TTS for voice response
            })
          });

          if (!response.ok) {
            console.error("📢 Call mode: Response not OK", response.status, response.statusText);
            throw new Error(`Failed to process audio: ${response.status} ${response.statusText}`);
          }

          if (!response.body) {
            console.error("📢 Call mode: No response body");
            throw new Error('No response body');
          }

          console.log("📢 Call mode: Processing response stream");
          // Process streaming response (same as existing code)
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let lastUpdate = Date.now();
          const UPDATE_INTERVAL = 50;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            buffer += chunk;
            
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                console.log("📢 Call mode: Received data type:", data.type);

                if (data.type === 'transcription') {
                  console.log("📢 Call mode: Received transcription:", data.content.substring(0, 50) + "...");
                  setMessages(prev => [...prev, { 
                    role: "user", 
                    content: data.content, 
                    type: "text", 
                    isComplete: true,
                    isVoiceMessage: true
                  }]);
                } else if (data.type === 'stream-chunk') {
                  setShowBotTyping(false);
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
                  console.log("📢 Call mode: Stream complete");
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
                  console.log("📢 Call mode: Received TTS audio");
                  const audioUrl = `data:${data.mimeType};base64,${data.audio}`;
                  setTtsAudioUrl(audioUrl);
                  
                  if (audioRef.current) {
                    console.log("📢 Call mode: Setting audio source and preparing to play");
                    audioRef.current.src = audioUrl;
                    // Wait longer for the audio to be ready
                    audioRef.current.oncanplay = () => {
                      console.log("📢 Call mode: Audio can play now, auto-playing");
                      setIsAudioPlaying(true); // Set this before play() to avoid race conditions
                      audioRef.current?.play().catch(e => {
                        console.error("📢 Call mode: Auto-play error:", e);
                        setIsAudioPlaying(false); // Reset if play fails
                      });
                    };
                  }
                } else if (data.type === 'error') {
                  console.error("📢 Call mode: Error from API:", data.error, data.details);
                  throw new Error(data.error);
                }
              } catch (error) {
                console.error('📢 Call mode: Error processing chunk:', error);
              }
            }
          }
        } catch (error) {
          console.error("📢 Call mode: Error processing call audio:", error);
          setError(error instanceof Error ? error.message : "Failed to process audio");
        } finally {
          setIsLoading(false);
          setShowBotTyping(false);
          
          // If still in call mode, continue listening
          if (isInCallMode) {
            console.log("📢 Call mode: Continuing to listen in call mode");
          }
        }
      };
      
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error("📢 Call mode: Error processing call audio:", error);
      setError("Failed to process call audio");
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-white to-gray-50 rounded-xl border max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b bg-white/80 backdrop-blur-sm rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
          🤖
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
          disabled={isClearingChat || isLoading}
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

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-280px)] sm:h-[calc(100vh-280px)]" ref={scrollAreaRef}>
          <div className="space-y-6 p-6 pt-12">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"} w-full max-w-[75%] sm:max-w-[90%]`}>
                  <div
                    className={`rounded-2xl px-4 py-2 sm:px-5 sm:py-3 flex flex-col w-fit break-words ${
                      message.role === "user"
                        ? message.isVoiceMessage 
                          ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                          : "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20"
                        : "bg-white text-gray-800 shadow-lg shadow-gray-200/50 border border-gray-100"
                    }`}
                  >
                    <div className="w-full">
                        <div className={`prose prose-sm max-w-none ${message.role === "user" ? "dark:prose-invert text-white" : "text-gray-800"} !text-[15px] sm:!text-[16px]`}>
                          <ReactMarkdown
                            components={{
                              h1: ({children}) => <h1 className="text-xl font-bold mb-2 border-b pb-1">{children}</h1>,
                              h2: ({children}) => <h2 className="text-lg font-bold mb-2 mt-4">{children}</h2>,
                              h3: ({children}) => <h3 className="text-base font-bold mb-1 mt-3">{children}</h3>,
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              ul: ({children}) => <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>,
                              li: ({children}) => <li className="mb-1">{children}</li>,
                              a: ({ href, children }) => (
                                <a href={href} className={`${message.role === "user" ? "text-blue-100" : "text-blue-500"} hover:underline`} target="_blank" rel="noopener noreferrer">
                                  {children}
                                </a>
                              ),
                              code: ({ children }) => (
                                <code className={`${message.role === "user" ? "bg-blue-400/30" : "bg-gray-100"} rounded px-1 py-0.5 text-sm`}>
                                  {children}
                                </code>
                              ),
                              pre: ({ children }) => (
                                <pre className={`${message.role === "user" ? "bg-blue-400/30" : "bg-gray-100"} rounded p-2 text-sm overflow-x-auto my-2`}>
                                  {children}
                                </pre>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className={`border-l-2 ${message.role === "user" ? "border-blue-300" : "border-gray-300"} pl-3 italic my-2`}>
                                  {children}
                                </blockquote>
                              ),
                              hr: () => <hr className="my-3 border-t border-gray-200" />
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                    </div>
                  </div>
                  {message.isVoiceMessage && (
                    <div className={`flex items-center gap-1 mt-1 text-xs text-gray-400 ${message.role === "user" ? "self-end" : "self-start"}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                        <line x1="12" x2="12" y1="19" y2="22"></line>
                      </svg>
                      <span>Voice Message</span>
                    </div>
                  )}
                  {message.role === "assistant" && ttsAudioUrl && lastMessageWasVoice && index === messages.length - 1 && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400 self-start cursor-pointer hover:text-blue-500"
                      onClick={toggleAudio}>
                      {isAudioPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      <span>Voice Response</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Bot typing indicator placeholder with glowing lines */}
            {showBotTyping && (
              <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="max-w-[75%] rounded-2xl px-5 py-3 flex flex-col bg-white text-gray-800 shadow-lg shadow-gray-200/50 border border-gray-100">
                  <div className="flex flex-col gap-1.5 w-36">
                    <div className="h-2 rounded-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse"></div>
                    <div className="h-2 w-2/3 rounded-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse delay-75"></div>
                  </div>
                </div>
              </div>
            )}
            
            {audioPlaceholder && (
              <div
                className={`flex ${audioPlaceholder.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-5 py-3 flex flex-col ${
                    audioPlaceholder.role === "user"
                      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20"
                      : "bg-white text-gray-800 shadow-lg shadow-gray-200/50 border border-gray-100"
                  }`}
                >
                  <div className="w-full">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
                      <span className="text-sm">
                        {audioPlaceholder.role === "user" ? "Processing audio..." : "Generating response..."}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t bg-white/80 backdrop-blur-sm rounded-b-xl">
        {isRecording && (
          <div className="mb-3">
            <AudioVisualizer isRecording={isRecording} stream={audioStream} />
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleRecording}
            disabled={isLoading || isInCallMode || !isDataLoaded}
            className={`rounded-full ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}
          >
            {isRecording ? (
              <div className="h-4 w-4 rounded-full bg-white animate-pulse" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mic">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" x2="12" y1="19" y2="22"></line>
              </svg>
            )}
          </Button>
          
          {/* Call Mode Button */}
          <Button
            variant={isInCallMode ? "destructive" : "outline"}
            size="icon"
            onClick={toggleCallMode}
            disabled={isLoading || isRecording || !isDataLoaded}
            className="rounded-full"
            title={isInCallMode ? "End Call" : "Start Call"}
          >
            {isInCallMode ? <PhoneOff size={20} /> : <Phone size={20} />}
          </Button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={isLoadingHistory ? "Loading data..." : isInCallMode ? "Call mode active - listening..." : "Type your message..."}
              className="w-full px-3 py-2 sm:px-4 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[15px] sm:text-base"
              disabled={isLoading || isInCallMode || !isDataLoaded}
            />
            {isLoading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
              </div>
            )}
            {isSilent && isInCallMode && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                Processing...
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading || isInCallMode || !isDataLoaded}
            className="rounded-full"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Call mode indicator */}
        {isInCallMode && (
          <div className="mt-2 text-xs text-center flex items-center justify-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isSilent ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}></div>
            <span className="text-gray-600">
              {isSilent ? "Listening - silence detected" : "Call mode active - speak now"}
            </span>
          </div>
        )}
      </div>

      {/* Loading indicator for initial data fetch */}
      {isLoadingHistory && (
        <div className="text-center text-sm text-gray-500 mt-2">
          Loading conversation and user data... Please wait.
        </div>
      )}

      {/* Audio element for TTS */}
      <audio 
        ref={audioRef} 
        className="hidden" 
        preload="auto" 
        onError={(e) => console.error("Audio element error:", e)}
        onLoadedData={() => console.log("Audio data loaded")}
      />
    </div>
  );
}
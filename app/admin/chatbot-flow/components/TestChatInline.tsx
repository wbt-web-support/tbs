"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, RefreshCw, RotateCcw, Globe, Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AudioVisualizer } from "@/components/audio-visualizer";
import { MediaPlayer } from "@/components/MediaPlayer";
import { toast } from "sonner";

const STORAGE_KEY_PREFIX = "chatbot-flow-test-";

type Message = { role: "user" | "assistant"; content: string; thoughtSummary?: string; id?: string };

function getStorageKey(chatbotId: string) {
  return `${STORAGE_KEY_PREFIX}${chatbotId}`;
}

function loadPersistedState(chatbotId: string): { selectedUser: string; messages: Message[]; useWebSearch?: boolean } {
  if (typeof window === "undefined") return { selectedUser: "__default__", messages: [] };
  try {
    const raw = localStorage.getItem(getStorageKey(chatbotId));
    if (!raw) return { selectedUser: "__default__", messages: [] };
    const data = JSON.parse(raw) as { selectedUser?: string; messages?: Message[]; useWebSearch?: boolean };
    const selectedUser = typeof data?.selectedUser === "string" ? data.selectedUser : "__default__";
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    const useWebSearch = typeof data?.useWebSearch === "boolean" ? data.useWebSearch : false;
    return { selectedUser, messages, useWebSearch };
  } catch {
    return { selectedUser: "__default__", messages: [] };
  }
}

function savePersistedState(chatbotId: string, selectedUser: string, messages: Message[], useWebSearch?: boolean) {
  try {
    localStorage.setItem(
      getStorageKey(chatbotId),
      JSON.stringify({ selectedUser, messages, useWebSearch: useWebSearch ?? false })
    );
  } catch {
    // ignore quota or other storage errors
  }
}

type TestUser = {
  id: string;
  email: string;
  full_name: string;
  team_id: string | null;
  role: string;
};

type InstructionBlock = { nodeName: string; content: string };
type DataModule = { nodeName: string; label: string; dataSource: string; content: string };

type Props = {
  chatbotId: string;
  chatbotName?: string;
};

export function TestChatInline({ chatbotId, chatbotName }: Props) {
  const [fullPrompt, setFullPrompt] = useState<string>("");
  const [basePrompt, setBasePrompt] = useState<string>("");
  const [instructionBlocks, setInstructionBlocks] = useState<InstructionBlock[]>([]);
  const [dataModules, setDataModules] = useState<DataModule[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("__default__");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceConfig, setVoiceConfig] = useState<{ tts_enabled: boolean; stt_enabled: boolean; voice_id: string; auto_play_responses: boolean } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Map<string, string>>(new Map());
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [contextRefreshing, setContextRefreshing] = useState(false);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const testUsersRef = useRef<TestUser[]>([]);
  const skipNextPersistRef = useRef(true); // skip persist until after we've loaded from storage
  testUsersRef.current = testUsers;

  const refreshContext = useCallback(async () => {
    if (!chatbotId) return;
    setContextRefreshing(true);
    const users = testUsersRef.current;
    const user = selectedUser && selectedUser !== "__default__" ? users.find((u) => u.id === selectedUser) : null;
    const body: { chatbotId: string; userId?: string; teamId?: string; structured: boolean } = {
      chatbotId,
      structured: true,
    };
    if (user) {
      body.userId = user.id;
      body.teamId = user.team_id ?? undefined;
    }
    try {
      const r = await fetch("/api/chatbot-flow/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (data.prompt != null) {
        setFullPrompt(data.prompt);
        setBasePrompt(data.basePrompt ?? "");
        setInstructionBlocks(Array.isArray(data.instructionBlocks) ? data.instructionBlocks : []);
        setDataModules(Array.isArray(data.dataModules) ? data.dataModules : []);
        setWebSearchEnabled(Boolean(data.webSearchEnabled));
        setVoiceEnabled(Boolean(data.voiceEnabled));
        setVoiceConfig(data.voiceConfig ?? null);
      } else {
        setFullPrompt("");
        setBasePrompt("");
        setInstructionBlocks([]);
        setDataModules([]);
        setWebSearchEnabled(false);
        setVoiceEnabled(false);
        setVoiceConfig(null);
      }
    } catch {
      setFullPrompt("");
      setBasePrompt("");
      setInstructionBlocks([]);
      setDataModules([]);
      setWebSearchEnabled(false);
      setVoiceEnabled(false);
      setVoiceConfig(null);
    } finally {
      setContextRefreshing(false);
    }
  }, [chatbotId, selectedUser]);

  // Cleanup audio streams on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
    };
  }, []);

  // Cleanup audio URLs on unmount
  useEffect(() => {
    return () => {
      audioUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [audioUrls]);

  useEffect(() => {
    setUsersLoading(true);
    fetch("/api/chatbot-flow/test-users")
      .then((r) => r.json())
      .then((data) => {
        setTestUsers(data.users ?? []);
      })
      .catch(() => setTestUsers([]))
      .finally(() => setUsersLoading(false));
  }, []);

  // Load from localStorage when chatbotId changes (or on mount)
  useLayoutEffect(() => {
    if (!chatbotId) return;
    skipNextPersistRef.current = true; // do not overwrite storage when persist effect runs after this
    const { selectedUser: savedUser, messages: savedMessages, useWebSearch: savedUseWebSearch } = loadPersistedState(chatbotId);
    setSelectedUser(savedUser);
    setMessages(savedMessages);
    setUseWebSearch(savedUseWebSearch ?? false);
    setInput("");
    setError(null);
  }, [chatbotId]);

  // Persist selected user, messages, and useWebSearch so they survive page reloads
  useEffect(() => {
    if (!chatbotId) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    savePersistedState(chatbotId, selectedUser, messages, useWebSearch);
  }, [chatbotId, selectedUser, messages, useWebSearch]);

  // Refetch context when chatbot, selected user, or test users list changes (e.g. after reload when testUsers load and selectedUser was restored from storage)
  useEffect(() => {
    if (chatbotId) {
      refreshContext();
    }
  }, [chatbotId, selectedUser, refreshContext, testUsers]);

  // Scroll to show the latest message or "Thinking..." while the LLM is responding
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  // Toggle voice recording (STT)
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      setIsRecording(false);
    } else {
      // Start recording
      try {
        setIsRecording(true);
        audioChunksRef.current = [];

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        audioStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

          // Send to STT endpoint
          setIsTranscribing(true);
          try {
            const formData = new FormData();
            formData.append("file", audioBlob, "recording.webm");

            const response = await fetch("/api/ai-instructions/stt", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: "Failed to transcribe audio" }));
              throw new Error(errorData.error || errorData.details || "Failed to transcribe audio");
            }

            const data = await response.json();

            if (data.text) {
              setInput(data.text);
            } else {
              throw new Error("No transcription returned");
            }
          } catch (error) {
            console.error("Error transcribing audio:", error);
            toast.error(error instanceof Error ? error.message : "Failed to transcribe audio");
          } finally {
            setIsTranscribing(false);
          }
        };

        recorder.start();
      } catch (error) {
        console.error("Error starting recording:", error);
        setIsRecording(false);
        if (error instanceof Error && error.name === "NotAllowedError") {
          toast.error("Microphone permission denied. Please allow microphone access.");
        } else {
          toast.error("Failed to start recording. Please try again.");
        }
      }
    }
  };

  // Load TTS audio for a message
  const handlePlayMessage = async (messageId: string, text: string) => {
    // If clicking on currently playing message, close player
    if (playingMessageId === messageId) {
      setPlayingMessageId(null);
      return;
    }

    // Check if we already have audio cached
    const cachedUrl = audioUrls.get(messageId);
    if (cachedUrl) {
      setPlayingMessageId(messageId);
      return;
    }

    // Load TTS audio
    setLoadingAudio(messageId);
    try {
      const response = await fetch("/api/ai-instructions/tts-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice_id: voiceConfig?.voice_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to generate audio" }));
        const errorMsg = errorData.details || errorData.error || "Failed to generate audio";
        throw new Error(errorMsg);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Cache the audio URL
      setAudioUrls((prev) => new Map(prev).set(messageId, audioUrl));
      setPlayingMessageId(messageId);
    } catch (error) {
      console.error("TTS error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load audio");
    } finally {
      setLoadingAudio(null);
    }
  };

  const handleReset = useCallback(() => {
    if (!chatbotId) return;
    try {
      localStorage.removeItem(getStorageKey(chatbotId));
    } catch {}
    setSelectedUser("__default__");
    setUseWebSearch(false);
    setMessages([]);
    setInput("");
    setError(null);
  }, [chatbotId]);

  const history = messages.map((m) => ({
    role: m.role as "user" | "model",
    parts: [{ text: m.content }],
  }));

  const contextLoading =
    contextRefreshing || (selectedUser !== "__default__" && usersLoading);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    // Build history from current messages so context is up to date (before we add this turn)
    const historyToSend = messages.map((m) => ({
      role: m.role as "user" | "model",
      parts: [{ text: m.content }],
    }));
    setMessages((prev) => [...prev, { role: "user", content: text, id: `user-${Date.now()}` }]);
    setLoading(true);
    setError(null);
    const user = selectedUser && selectedUser !== "__default__" ? testUsers.find((u) => u.id === selectedUser) : null;
    const body: {
      chatbotId: string;
      message: string;
      history: { role: "user" | "model"; parts: { text: string }[] }[];
      includeThoughts: boolean;
      userId?: string;
      teamId?: string;
      use_web_search?: boolean;
    } = {
      chatbotId,
      message: text,
      history: historyToSend,
      includeThoughts: true,
      use_web_search: useWebSearch,
    };
    if (user) {
      body.userId = user.id;
      body.teamId = user.team_id ?? undefined;
    }
    try {
      const res = await fetch("/api/chatbot-flow/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      const assistantMsg = {
        role: "assistant" as const,
        content: data.reply ?? "",
        thoughtSummary: data.thoughtSummary,
        id: `assistant-${Date.now()}`,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Auto-play if enabled
      if (voiceConfig?.auto_play_responses && voiceConfig?.tts_enabled && assistantMsg.content) {
        setTimeout(() => {
          handlePlayMessage(assistantMsg.id!, assistantMsg.content);
        }, 100);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Context (top) */}
      <div className="shrink-0 border-b border-border bg-muted/10">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Context</p>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Test as user</Label>
            <Select value={selectedUser} onValueChange={(v) => { setSelectedUser(v); }} disabled={usersLoading}>
              <SelectTrigger className="w-[220px] h-8 text-xs border-border">
                <SelectValue placeholder={usersLoading ? "Loading users..." : "Default (no specific user)"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Default (no specific user)</SelectItem>
                {testUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name ? `${u.full_name} (${u.email})` : u.email} ({u.role})
                    {u.team_id ? " · team" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {webSearchEnabled && (
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <Checkbox
                  checked={useWebSearch}
                  onCheckedChange={(c) => setUseWebSearch(Boolean(c))}
                  aria-label="Search web"
                />
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  Search web
                </span>
              </label>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshContext}
              disabled={contextRefreshing || !chatbotId}
              title="Refresh context"
              className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-4 w-4 ${contextRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[180px] border-t border-border">
          <div className="p-3 space-y-2">
            <details className="rounded-lg border border-border overflow-hidden bg-background">
              <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/30 hover:bg-muted/50 border-b border-border">
                Base prompt
              </summary>
              <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono">
                {contextLoading ? "Loading..." : basePrompt || "(empty)"}
              </pre>
            </details>
            {instructionBlocks.map((block, i) => (
              <details key={`inst-${i}`} className="rounded-lg border border-border overflow-hidden bg-background">
                <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/30 hover:bg-muted/50 border-b border-border">
                  Instructions: {block.nodeName}
                </summary>
                <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono">
                  {contextLoading ? "Loading..." : block.content}
                </pre>
              </details>
            ))}
            {dataModules.map((mod, i) => (
              <details key={`data-${i}`} className="rounded-lg border border-border overflow-hidden bg-background">
                <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/30 hover:bg-muted/50 border-b border-border">
                  Data: {mod.label} ({mod.nodeName})
                </summary>
                <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono max-h-32 overflow-auto">
                  {contextLoading ? "Loading..." : mod.content}
                </pre>
              </details>
            ))}
            <details className="rounded-lg border border-border overflow-hidden bg-background">
              <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/30 hover:bg-muted/50 border-b border-border">
                Full context (everything sent to the LLM)
              </summary>
              <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono max-h-40 overflow-auto">
                {contextLoading ? "Loading..." : fullPrompt || "(empty)"}
              </pre>
            </details>
          </div>
        </ScrollArea>
      </div>

      {/* Chat (bottom) */}
      <div className="flex flex-col flex-1 min-h-0 border-t border-border">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between gap-2 shrink-0">
          {chatbotName && (
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Test: {chatbotName}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
            title="Reset test user and chat history"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        </div>
        <ScrollArea className="flex-1 min-h-0 px-4">
          <div className="py-4 space-y-4">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Send a message to test the chatbot.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{m.role}</span>
                <div
                  className={
                    m.role === "user"
                      ? "inline-block mt-1 px-4 py-2.5 rounded-lg border border-border bg-muted text-sm max-w-[85%]"
                      : "mt-1 px-4 py-2.5 rounded-lg border border-border bg-muted/40 text-sm text-left max-w-[85%]"
                  }
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          a: ({ href, children }) => (
                            <a href={href} className="text-primary underline" target="_blank" rel="noopener noreferrer">
                              {children}
                            </a>
                          ),
                          code: ({ children }) => (
                            <code className="bg-background/50 rounded px-1.5 py-0.5 text-xs font-mono">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="bg-background/50 rounded p-2 text-xs font-mono overflow-x-auto my-2">
                              {children}
                            </pre>
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
                {m.role === "assistant" && voiceConfig?.tts_enabled && m.id && (
                  <>
                    {loadingAudio === m.id ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-7 px-2 text-xs"
                        disabled
                        title="Loading audio..."
                      >
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading...
                      </Button>
                    ) : playingMessageId === m.id && audioUrls.has(m.id) ? (
                      <MediaPlayer
                        audioUrl={audioUrls.get(m.id)!}
                        onEnded={() => setPlayingMessageId(null)}
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePlayMessage(m.id!, m.content)}
                        className="mt-1 h-7 px-2 text-xs"
                        disabled={isTranscribing || loading}
                        title="Play as audio"
                      >
                        <Volume2 className="h-3 w-3 mr-1" /> Play
                      </Button>
                    )}
                  </>
                )}
                {m.thoughtSummary && (
                  <details className="mt-1 text-xs text-muted-foreground">
                    <summary>Thought summary</summary>
                    <pre className="whitespace-pre-wrap mt-1 p-2 rounded-lg border border-border bg-muted/20">{m.thoughtSummary}</pre>
                  </details>
                )}
              </div>
            ))}
            {loading && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span>Thinking...</span>
                {useWebSearch && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground/90">
                    <Globe className="h-3.5 w-3.5 animate-pulse" />
                    Searching the web
                  </span>
                )}
              </p>
            )}
            <div ref={scrollAnchorRef} aria-hidden="true" className="h-0 w-full" />
          </div>
        </ScrollArea>

        {error && (
          <div className="mx-4 mt-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm shrink-0">
            {error}
          </div>
        )}

        <div className="p-4 flex flex-col gap-2 shrink-0 border-t border-border bg-muted/5">
          {isRecording && <AudioVisualizer isRecording={isRecording} stream={audioStreamRef.current} />}
          {isTranscribing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Transcribing audio...
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              placeholder={isRecording ? "Recording..." : "Type a message..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={2}
              className="resize-none w-full min-w-0 rounded-lg border-border"
              disabled={isRecording || isTranscribing}
            />
            {voiceConfig?.stt_enabled && (
              <Button
                variant={isRecording ? "destructive" : "outline"}
                size="icon"
                onClick={toggleRecording}
                disabled={isTranscribing || loading}
                title={isRecording ? "Stop recording" : "Start voice recording"}
                className="shrink-0 h-[72px]"
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
          </div>
          <Button onClick={sendMessage} disabled={loading || isRecording || isTranscribing} className="shrink-0 w-full">
            <Send className="h-4 w-4 mr-1.5" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

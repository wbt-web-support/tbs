"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Globe, RefreshCw, Bug, Paperclip, FileText, Image, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export type Message = { role: "user" | "assistant"; content: string };

type QuickAction = { label: string; prompt: string };

type InstructionBlock = { nodeName: string; content: string };
type DataModule = { nodeName: string; label: string; dataSource: string; content: string };

export type AiChatProps = {
  /** Chatbot id from chatbot flow (required). */
  chatbotId: string;
  /** Display name for the chatbot (e.g. "Business owner"). */
  chatbotName?: string;
  /** Optional quick-action buttons shown when there are no messages. */
  quickActions?: QuickAction[];
  /** Optional custom greeting when there are no messages. */
  greetingTitle?: string;
  /** Optional custom subtitle. */
  greetingSubtitle?: string;
  /** Show debug/context panel (default true). */
  showDebugPanel?: boolean;
};

export function AiChat({
  chatbotId,
  chatbotName,
  quickActions = [],
  greetingTitle,
  greetingSubtitle = "How can I assist you today?",
  showDebugPanel = true,
}: AiChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [attachmentsEnabled, setAttachmentsEnabled] = useState(false);
  const [attachments, setAttachments] = useState<
    { id: string; type: "image" | "document"; url?: string; text?: string; fileName: string }[]
  >([]);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [basePrompt, setBasePrompt] = useState("");
  const [instructionBlocks, setInstructionBlocks] = useState<InstructionBlock[]>([]);
  const [dataModules, setDataModules] = useState<DataModule[]>([]);
  const [fullPrompt, setFullPrompt] = useState("");
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MIN_TEXTAREA_HEIGHT = 60;
  const MAX_TEXTAREA_HEIGHT = 500;

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const h = Math.min(Math.max(el.scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT);
    el.style.height = `${h}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [inputText, resizeTextarea]);

  const getGreetingMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  useEffect(() => {
    const loadUserName = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const { data } = await supabase
          .from("business_info")
          .select("full_name")
          .eq("user_id", session.user.id)
          .single();
        if (data?.full_name) {
          const first = data.full_name.trim().split(/\s+/)[0];
          if (first) setUserName(first);
        }
      } catch {
        // ignore
      }
    };
    loadUserName();
  }, []);

  const fetchContext = useCallback(async () => {
    if (!chatbotId) return;
    setContextLoading(true);
    setContextError(null);
    try {
      const r = await fetch(`/api/chatbot-flow/public/chatbots/${chatbotId}/context`);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "Failed to load context");
      setBasePrompt(data.basePrompt ?? "");
      setInstructionBlocks(Array.isArray(data.instructionBlocks) ? data.instructionBlocks : []);
      setDataModules(Array.isArray(data.dataModules) ? data.dataModules : []);
      setFullPrompt(data.fullPrompt ?? "");
      if (data.webSearchEnabled != null) setWebSearchEnabled(Boolean(data.webSearchEnabled));
      if (data.attachmentsEnabled != null) setAttachmentsEnabled(Boolean(data.attachmentsEnabled));
    } catch (e) {
      setContextError(e instanceof Error ? e.message : "Failed to load context");
    } finally {
      setContextLoading(false);
    }
  }, [chatbotId]);

  // Fetch chatbot details (name + webSearchEnabled); when done, hide skeleton
  useEffect(() => {
    if (!chatbotId) {
      setInitialLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/chatbot-flow/public/chatbots/${chatbotId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setWebSearchEnabled(Boolean(data?.webSearchEnabled));
        setAttachmentsEnabled(Boolean(data?.attachmentsEnabled));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chatbotId]);

  useEffect(() => {
    if (chatbotId && showDebugPanel) fetchContext();
  }, [chatbotId, showDebugPanel, fetchContext]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const addImage = useCallback(async (file: File) => {
    setAttachmentUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await fetch("/api/chat-image-upload", { method: "POST", body: formData });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "Upload failed");
      setAttachments((prev) => [
        ...prev,
        { id: crypto.randomUUID(), type: "image" as const, url: data.url, fileName: file.name },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setAttachmentUploading(false);
    }
  }, []);

  const addPdf = useCallback(async (file: File) => {
    setAttachmentUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await fetch("/api/extract/pdf", { method: "POST", body: formData });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "Extraction failed");
      setAttachments((prev) => [
        ...prev,
        { id: crypto.randomUUID(), type: "document" as const, text: data.content ?? "", fileName: file.name },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF extraction failed");
    } finally {
      setAttachmentUploading(false);
    }
  }, []);

  const addDoc = useCallback(async (file: File) => {
    setAttachmentUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await fetch("/api/extract/doc", { method: "POST", body: formData });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "Extraction failed");
      setAttachments((prev) => [
        ...prev,
        { id: crypto.randomUUID(), type: "document" as const, text: data.content ?? "", fileName: file.name },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Document extraction failed");
    } finally {
      setAttachmentUploading(false);
    }
  }, []);

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? inputText).trim();
    if (!text || loading) return;
    setInputText("");
    setError(null);

    const historyToSend = messages.map((m) => ({
      role: m.role as "user" | "model",
      parts: [{ text: m.content }],
    }));

    const attachmentsToSend = attachmentsEnabled
      ? attachments.map((a) =>
          a.type === "image" ? { type: "image" as const, url: a.url! } : { type: "document" as const, text: a.text ?? "", fileName: a.fileName }
        )
      : [];

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setAttachments([]);
    setLoading(true);

    try {
      const res = await fetch(`/api/chatbot-flow/chatbots/${chatbotId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: historyToSend,
          use_web_search: useWebSearch,
          ...(attachmentsToSend.length ? { attachments: attachmentsToSend } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Request failed");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "" },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      if (
        msg.includes("Gemini") ||
        msg.includes("NEXT_PUBLIC_GEMINI_API_KEY") ||
        msg.includes("generativelanguage.googleapis.com") ||
        msg.includes("Could not reach")
      ) {
        setError(
          "The AI service is temporarily unavailable. Please check that NEXT_PUBLIC_GEMINI_API_KEY is set in .env and try again later."
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showGreeting = messages.length === 0;

  if (initialLoading) {
    return (
      <div className="flex flex-col h-full w-full">
        {showDebugPanel && (
          <div className="absolute top-2 right-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-3xl mx-auto space-y-6">
            <div className="text-center space-y-3">
              <Skeleton className="h-10 w-64 mx-auto" />
              <Skeleton className="h-5 w-80 mx-auto" />
            </div>
            <div className="rounded-2xl border border-border bg-background p-4 space-y-4">
              <Skeleton className="h-[60px] w-full rounded-lg" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20 rounded-lg" />
                  <Skeleton className="h-8 w-16 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-16 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Context popup trigger (only when showDebugPanel) */}
      {showDebugPanel && (
        <div className="absolute top-2 right-2">
          <Dialog onOpenChange={(open) => open && fetchContext()}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground gap-2"
              >
                <Bug className="h-4 w-4" />
                Context
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader className="shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  Context (what the chatbot sees for your account)
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.preventDefault(); fetchContext(); }}
                    disabled={contextLoading || !chatbotId}
                    title="Refresh context"
                    className="h-8 w-8"
                  >
                    <RefreshCw className={cn("h-4 w-4", contextLoading && "animate-spin")} />
                  </Button>
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 min-h-0 border rounded-lg border-border">
                <div className="p-3 space-y-2">
                  <details className="rounded-lg border border-border overflow-hidden bg-muted/20">
                    <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/30 hover:bg-muted/50 border-b border-border">
                      Base prompt
                    </summary>
                    <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono">
                      {contextLoading ? "Loading..." : basePrompt || "(empty)"}
                    </pre>
                  </details>
                  {instructionBlocks.map((block, i) => (
                    <details key={`inst-${i}`} className="rounded-lg border border-border overflow-hidden bg-muted/20">
                      <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/30 hover:bg-muted/50 border-b border-border">
                        Instructions: {block.nodeName}
                      </summary>
                      <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono">
                        {contextLoading ? "Loading..." : block.content}
                      </pre>
                    </details>
                  ))}
                  {dataModules.map((mod, i) => (
                    <details key={`data-${i}`} className="rounded-lg border border-border overflow-hidden bg-muted/20">
                      <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/30 hover:bg-muted/50 border-b border-border">
                        Data: {mod.label} ({mod.nodeName})
                      </summary>
                      <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono max-h-32 overflow-auto">
                        {contextLoading ? "Loading..." : mod.content}
                      </pre>
                    </details>
                  ))}
                  <details className="rounded-lg border border-border overflow-hidden bg-muted/20">
                    <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/30 hover:bg-muted/50 border-b border-border">
                      Full context (everything sent to the LLM)
                    </summary>
                    <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono max-h-40 overflow-auto">
                      {contextLoading ? "Loading..." : fullPrompt || "(empty)"}
                    </pre>
                  </details>
                  {contextError && (
                    <p className="text-xs text-destructive px-3 py-2">{contextError}</p>
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Messages area */}
      {!showGreeting && (
        <div className="flex-1 overflow-hidden bg-background">
          <ScrollArea className="h-full">
            <div className="max-w-4xl mx-auto w-full">
              <div className="space-y-6 py-6 pb-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[90%]",
                        message.role === "user"
                          ? "bg-muted text-foreground px-3 py-2 rounded-xl"
                          : "bg-background text-foreground"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown
                            components={{
                              p: ({ ...props }) => (
                                <p {...props} className="mb-3 last:mb-0 leading-relaxed text-[15px]" />
                              ),
                              ul: ({ ...props }) => (
                                <ul {...props} className="mb-3 last:mb-0 space-y-1 list-none pl-0" />
                              ),
                              ol: ({ ...props }) => (
                                <ol {...props} className="mb-3 last:mb-0 space-y-1 list-decimal pl-5" />
                              ),
                              li: ({ ...props }) => (
                                <li {...props} className="leading-relaxed text-[15px]" />
                              ),
                              strong: ({ ...props }) => (
                                <strong {...props} className="font-semibold" />
                              ),
                              a: ({ href, ...props }) => (
                                <a
                                  href={href}
                                  {...props}
                                  className="text-primary underline underline-offset-2"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              ),
                              code: ({ className, ...props }) => (
                                <code
                                  {...props}
                                  className={cn(
                                    "bg-muted px-1.5 py-0.5 rounded text-sm font-mono",
                                    className
                                  )}
                                />
                              ),
                              pre: ({ ...props }) => (
                                <pre
                                  {...props}
                                  className="bg-muted border border-border rounded-lg p-4 text-sm overflow-x-auto my-3 font-mono"
                                />
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed text-[15px]">
                          {message.content}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl border border-border bg-muted/50 px-4 py-3 flex items-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span>
                        {useWebSearch && webSearchEnabled ? "Searching the web..." : "Thinking..."}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Input area - centered when greeting, bottom when messages */}
      <div
        className={cn(
          "",
          showGreeting && "flex-1 flex items-center justify-center"
        )}
      >
        <div
          className={cn(
            "w-full",
            showGreeting ? "max-w-3xl mx-auto" : "max-w-4xl mx-auto"
          )}
        >
          {error && (
            <div className="mb-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
              {error}
            </div>
          )}

          {showGreeting && (
            <div className="text-center mb-8">
              <h1 className="text-4xl font-medium text-foreground mb-2">
                {getGreetingMessage()}{userName ? `, ${userName}` : ""} 👋
              </h1>
              <p className="text-muted-foreground text-base md:text-lg">
                {greetingSubtitle}
              </p>
            </div>
          )}

          {/* ChatGPT-like input: one box, then row with Attach, Search, Send */}
          <div className="rounded-2xl border border-border bg-background transition-colors focus-within:border-primary/50 shadow-sm">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={useWebSearch ? "Search on the web" : "Ask anything"}
              disabled={loading}
              rows={1}
              style={{ minHeight: MIN_TEXTAREA_HEIGHT, maxHeight: MAX_TEXTAREA_HEIGHT }}
              className="w-full resize-none overflow-y-auto bg-transparent border-0 focus:outline-none text-[15px] text-foreground placeholder:text-muted-foreground disabled:opacity-50 px-4 pt-4 pb-3"
            />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {attachments.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground"
                  >
                    {a.type === "image" ? <Image className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                    <span className="max-w-[120px] truncate">{a.fileName}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.id)}
                      className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground"
                      aria-label="Remove attachment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-2 px-2 pb-3 pt-0">
              <div className="flex items-center gap-1">
                {attachmentsEnabled && (
                  <>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) addImage(file);
                        e.target.value = "";
                      }}
                    />
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) addPdf(file);
                        e.target.value = "";
                      }}
                    />
                    <input
                      ref={docInputRef}
                      type="file"
                      accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) addDoc(file);
                        e.target.value = "";
                      }}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground rounded-lg"
                          title="Attach file"
                          disabled={loading || attachmentUploading}
                        >
                          {attachmentUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Paperclip className="h-4 w-4" />
                          )}
                          <span className="text-xs">Attach</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuItem onClick={() => imageInputRef.current?.click()} className="cursor-pointer">
                          <Image className="h-4 w-4 mr-2" />
                          Image
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => pdfInputRef.current?.click()} className="cursor-pointer">
                          <FileText className="h-4 w-4 mr-2" />
                          PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => docInputRef.current?.click()} className="cursor-pointer">
                          <FileText className="h-4 w-4 mr-2" />
                          Document
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
                {webSearchEnabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setUseWebSearch((v) => !v)}
                    className={cn(
                      "h-8 gap-1.5 rounded-lg",
                      useWebSearch
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title={useWebSearch ? "Web search on" : "Web search off"}
                  >
                    <Globe className="h-4 w-4" />
                    <span className="text-xs">Search</span>
                  </Button>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => sendMessage()}
                disabled={loading || !inputText.trim()}
                className="h-8 gap-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 border-0"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="text-xs">Send</span>
              </Button>
            </div>
          </div>

          {showGreeting && quickActions.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage(action.prompt)}
                  disabled={loading}
                  className="rounded-full"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

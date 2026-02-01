"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Send, RefreshCw } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string; thoughtSummary?: string };

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatbotId: string;
  chatbotName: string;
};

export function TestChatModal({ open, onOpenChange, chatbotId, chatbotName }: Props) {
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
  const [usersLoading, setUsersLoading] = useState(false);
  const [contextRefreshing, setContextRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshContext = useCallback(async () => {
    if (!chatbotId) return;
    setContextRefreshing(true);
    const user = selectedUser && selectedUser !== "__default__" ? testUsers.find((u) => u.id === selectedUser) : null;
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
      } else {
        setFullPrompt("");
        setBasePrompt("");
        setInstructionBlocks([]);
        setDataModules([]);
      }
    } catch {
      setFullPrompt("");
      setBasePrompt("");
      setInstructionBlocks([]);
      setDataModules([]);
    } finally {
      setContextRefreshing(false);
    }
  }, [chatbotId, selectedUser, testUsers]);

  useEffect(() => {
    if (open) {
      setUsersLoading(true);
      fetch("/api/chatbot-flow/test-users")
        .then((r) => r.json())
        .then((data) => {
          setTestUsers(data.users ?? []);
        })
        .catch(() => setTestUsers([]))
        .finally(() => setUsersLoading(false));
    }
  }, [open]);

  // Clear chat history and selection only when switching to a different chatbot (e.g. left the page).
  // Keep messages and selected user when just closing/reopening the modal on the same page.
  const prevChatbotIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevChatbotIdRef.current !== null && prevChatbotIdRef.current !== chatbotId) {
      setMessages([]);
      setError(null);
      setInput("");
      setSelectedUser("__default__");
    }
    prevChatbotIdRef.current = chatbotId;
  }, [chatbotId]);

  useEffect(() => {
    if (open && chatbotId) {
      refreshContext();
    }
  }, [open, chatbotId, refreshContext]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const history = messages.map((m) => ({
    role: m.role as "user" | "model",
    parts: [{ text: m.content }],
  }));

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    setError(null);
    const user = selectedUser && selectedUser !== "__default__" ? testUsers.find((u) => u.id === selectedUser) : null;
    const body: {
      chatbotId: string;
      message: string;
      history: typeof history;
      includeThoughts: boolean;
      userId?: string;
      teamId?: string;
    } = {
      chatbotId,
      message: text,
      history,
      includeThoughts: true,
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
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply ?? "",
          thoughtSummary: data.thoughtSummary,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Test: {chatbotName}</DialogTitle>
          <DialogDescription>
            Chat on the left; full context (system prompt + data) on the right. Choose a user to simulate their context.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: Chat UI */}
          <div className="flex flex-col w-full md:w-[45%] lg:w-[50%] border-r min-h-0">
            <div className="p-4 space-y-2 shrink-0">
              <Label>Test as user</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser} disabled={usersLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={usersLoading ? "Loading users..." : "Default (no specific user)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Default (no specific user)</SelectItem>
                  {testUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} (${u.email})` : u.email} ({u.role})
                      {u.team_id ? ` · team` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea ref={scrollRef} className="flex-1 min-h-0 px-4 border-t">
              <div className="py-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground">Send a message to test the chatbot.</p>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "text-right" : ""}>
                    <span className="text-xs font-medium text-muted-foreground">{m.role}</span>
                    <div
                      className={
                        m.role === "user"
                          ? "inline-block mt-1 px-3 py-2 rounded-md bg-muted text-sm"
                          : "mt-1 px-3 py-2 rounded-md bg-muted/50 text-sm text-left"
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
                    {m.thoughtSummary && (
                      <details className="mt-1 text-xs text-muted-foreground">
                        <summary>Thought summary</summary>
                        <pre className="whitespace-pre-wrap mt-1 p-2 bg-muted/30 rounded">{m.thoughtSummary}</pre>
                      </details>
                    )}
                  </div>
                ))}
                {loading && <p className="text-sm text-muted-foreground">Thinking...</p>}
              </div>
            </ScrollArea>

            {error && (
              <div className="mx-4 mt-2 p-2 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm shrink-0">
                {error}
              </div>
            )}

            <div className="p-4 flex flex-col gap-2 shrink-0 border-t w-full">
              <Textarea
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={2}
                className="resize-none w-full min-w-0"
              />
              <Button onClick={sendMessage} disabled={loading} className="shrink-0 self-end w-full">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Right: Context breakdown */}
          <div className="hidden md:flex flex-col w-[55%] lg:w-[50%] min-h-0 bg-muted/20">
            <div className="px-4 py-2 border-b text-sm font-medium shrink-0 flex items-center justify-between gap-2">
              <span>Context (instructions + data sent to the model)</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={refreshContext}
                disabled={contextRefreshing || !chatbotId}
                title="Refresh context"
                className="shrink-0 h-8 w-8"
              >
                <RefreshCw className={`h-4 w-4 ${contextRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-2">
                {contextRefreshing ? (
                  <p className="text-xs text-muted-foreground py-2">Refreshing...</p>
                ) : (
                  <>
                    <details className="border border-border rounded-md overflow-hidden">
                      <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/50 hover:bg-muted/70">
                        Base prompt
                      </summary>
                      <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono bg-background border-t border-border">
                        {basePrompt || "(empty)"}
                      </pre>
                    </details>
                    {instructionBlocks.map((block, i) => (
                      <details key={`inst-${i}`} className="border border-border rounded-md overflow-hidden">
                        <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/50 hover:bg-muted/70">
                          Instructions: {block.nodeName}
                        </summary>
                        <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono bg-background border-t border-border">
                          {block.content}
                        </pre>
                      </details>
                    ))}
                    {dataModules.map((mod, i) => (
                      <details key={`data-${i}`} className="border border-border rounded-md overflow-hidden">
                        <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/50 hover:bg-muted/70">
                          Data: {mod.label} ({mod.nodeName})
                        </summary>
                        <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono bg-background border-t border-border max-h-48 overflow-auto">
                          {mod.content}
                        </pre>
                      </details>
                    ))}
                    <details className="border border-border rounded-md overflow-hidden">
                      <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/50 hover:bg-muted/70">
                        Full context (everything sent to the LLM)
                      </summary>
                      <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono bg-background border-t border-border max-h-64 overflow-auto">
                        {fullPrompt || "(empty)"}
                      </pre>
                    </details>
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* On small screens show context in a collapsible block below chat */}
        <div className="md:hidden border-t">
          <details className="group">
            <summary className="px-4 py-2 text-sm font-medium cursor-pointer list-none border-b flex items-center justify-between gap-2">
              <span>Context (tap to expand)</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  refreshContext();
                }}
                disabled={contextRefreshing || !chatbotId}
                title="Refresh context"
                className="shrink-0 h-8 w-8"
              >
                <RefreshCw className={`h-4 w-4 ${contextRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </summary>
            <div className="p-3 space-y-2 max-h-[60vh] overflow-auto">
              {contextRefreshing ? (
                <p className="text-xs text-muted-foreground py-2">Refreshing...</p>
              ) : (
                <>
                  <details className="border border-border rounded-md overflow-hidden">
                    <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/50">
                      Base prompt
                    </summary>
                    <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono bg-background border-t border-border">
                      {basePrompt || "(empty)"}
                    </pre>
                  </details>
                  {instructionBlocks.map((block, i) => (
                    <details key={`inst-m-${i}`} className="border border-border rounded-md overflow-hidden">
                      <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/50">
                        Instructions: {block.nodeName}
                      </summary>
                      <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono bg-background border-t border-border">
                        {block.content}
                      </pre>
                    </details>
                  ))}
                  {dataModules.map((mod, i) => (
                    <details key={`data-m-${i}`} className="border border-border rounded-md overflow-hidden">
                      <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/50">
                        Data: {mod.label} ({mod.nodeName})
                      </summary>
                      <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono bg-background border-t border-border max-h-40 overflow-auto">
                        {mod.content}
                      </pre>
                    </details>
                  ))}
                  <details className="border border-border rounded-md overflow-hidden">
                    <summary className="px-3 py-2 text-xs font-medium cursor-pointer list-none bg-muted/50">
                      Full context (everything sent to the LLM)
                    </summary>
                    <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono bg-background border-t border-border max-h-48 overflow-auto">
                      {fullPrompt || "(empty)"}
                    </pre>
                  </details>
                </>
              )}
            </div>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
}

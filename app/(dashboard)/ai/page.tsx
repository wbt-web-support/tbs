"use client";

import { useState, useEffect } from "react";
import { AiChat } from "@/components/ai-chat";
import { Loader2 } from "lucide-react";

/** UUID of the chatbot to use for the business owner dashboard. Set in env as NEXT_PUBLIC_BUSINESS_OWNER_CHATBOT_ID. */
const BUSINESS_OWNER_CHATBOT_ID = process.env.NEXT_PUBLIC_BUSINESS_OWNER_CHATBOT_ID ?? "";

export default function AiPage() {
  const [chatbotId, setChatbotId] = useState<string | null>(null);
  const [chatbotName, setChatbotName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!BUSINESS_OWNER_CHATBOT_ID?.trim()) {
      setError("Business owner chatbot not configured. Set NEXT_PUBLIC_BUSINESS_OWNER_CHATBOT_ID to the chatbot UUID.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/chatbot-flow/public/chatbots/${BUSINESS_OWNER_CHATBOT_ID.trim()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.error) {
          setError(data.error === "Chatbot not found" ? "Chatbot not found or inactive. Check NEXT_PUBLIC_BUSINESS_OWNER_CHATBOT_ID." : data.error);
          return;
        }
        if (data?.id) {
          setChatbotId(data.id);
          setChatbotName(data.name ?? "AI");
        } else {
          setError("No chatbot data returned.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load chatbot.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[400px] items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading AI assistant...</p>
      </div>
    );
  }

  if (error || !chatbotId) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[400px] items-center justify-center gap-4 px-4">
        <p className="text-sm text-destructive text-center">{error ?? "No chatbot selected."}</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-5rem)] min-h-[400px] w-full flex flex-col">
      <AiChat
        chatbotId={chatbotId}
        chatbotName={chatbotName}
        greetingSubtitle="Ask about your business, priorities, or get quick insights."
        quickActions={[
          { label: "Today's priorities", prompt: "What are my top priorities today for my business?" },
          { label: "Quick insights", prompt: "Give me a quick insight or recommendation for my business." },
          { label: "What's new", prompt: "What's new or changed that I should know about?" },
        ]}
      />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { AiChat } from "@/components/ai-chat";
import { Loader2 } from "lucide-react";

const BUSINESS_OWNER_NAMES = ["business owner", "business owner chatbot"];

export default function AiPage() {
  const [chatbotId, setChatbotId] = useState<string | null>(null);
  const [chatbotName, setChatbotName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chatbot-flow/public/chatbots")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.chatbots) ? data.chatbots : [];
        const active = list.filter(
          (c: { is_active?: boolean }) => c.is_active !== false
        );
        const businessOwner = active.find((c: { name?: string }) =>
          BUSINESS_OWNER_NAMES.includes((c.name ?? "").toLowerCase().trim())
        );
        const chosen = businessOwner ?? active[0];
        if (chosen?.id) {
          setChatbotId(chosen.id);
          setChatbotName(chosen.name ?? "AI");
        } else {
          setError("No chatbots available. Add a chatbot in Admin → Chatbot Flow.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load chatbots.");
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

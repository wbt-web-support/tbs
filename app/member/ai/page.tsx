"use client";

import { useState, useEffect } from "react";
import { VoiceAgent } from "@/components/voice-agent";
import { getEffectiveUserId } from "@/lib/get-effective-user-id";
import { createClient } from "@/utils/supabase/client";
import { Loader2 } from "lucide-react";

const MEMBER_AGENT_NAMES = ["engineer", "member", "team member"];

type Agent = {
  id: string;
  name: string;
  description: string | null;
  elevenlabs_agent_id: string;
};

export default function MemberAiPage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | undefined>();
  const [userName, setUserName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const [agentsRes, effectiveUserId] = await Promise.all([
          fetch("/api/elevenlabs/agents/public").then((r) => r.json()),
          getEffectiveUserId(),
        ]);

        if (cancelled) return;

        // Select agent — prefer member-specific, fall back to first
        const list: Agent[] = Array.isArray(agentsRes?.agents)
          ? agentsRes.agents
          : [];
        const memberAgent = list.find((a) =>
          MEMBER_AGENT_NAMES.some((n) =>
            a.name.toLowerCase().trim().includes(n)
          )
        );
        const chosen = memberAgent ?? list[0];

        if (!chosen) {
          setError("No AI agents available. Contact your administrator.");
          return;
        }

        setAgent(chosen);

        if (!effectiveUserId) {
          setError("Unable to identify user.");
          return;
        }

        setUserId(effectiveUserId);

        const supabase = createClient();
        const { data: businessInfo } = await supabase
          .from("business_info")
          .select("team_id, full_name")
          .eq("user_id", effectiveUserId)
          .single();

        if (cancelled) return;

        if (businessInfo) {
          setTeamId(businessInfo.team_id || undefined);
          setUserName(businessInfo.full_name || undefined);
        }
      } catch {
        if (!cancelled) setError("Failed to load AI assistant.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] min-h-[400px] items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Loading AI assistant...
        </p>
      </div>
    );
  }

  if (error || !agent || !userId) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] min-h-[400px] items-center justify-center gap-4 px-4">
        <p className="text-sm text-destructive text-center">
          {error ?? "No agent selected."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[400px] w-full items-center justify-center p-4">
      <VoiceAgent
        agentId={agent.elevenlabs_agent_id}
        userId={userId}
        teamId={teamId}
        userName={userName}
      />
    </div>
  );
}

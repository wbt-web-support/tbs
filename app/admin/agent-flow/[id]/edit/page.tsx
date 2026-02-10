"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Bot,
  Save,
  CheckCircle,
  Wrench,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type ToolDefinition = {
  id: string;
  tool_key: string;
  name: string;
  description: string;
  supported_scopes: string[];
};

type AgentTool = {
  tool_key: string;
  is_enabled: boolean;
};

type Agent = {
  id: string;
  name: string;
  description: string | null;
  elevenlabs_agent_id: string | null;
  voice_id: string;
  system_prompt: string;
  first_message: string | null;
  is_active: boolean;
};

// Common ElevenLabs voices
const VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella (Female)" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (Female)" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi (Female)" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni (Male)" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli (Female)" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh (Male)" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold (Male)" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam (Male)" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam (Male)" },
];

export default function EditAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [availableTools, setAvailableTools] = useState<ToolDefinition[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchAgent = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/elevenlabs/agents/${id}`);
        if (!res.ok) {
          throw new Error("Failed to load agent");
        }
        const data = await res.json();

        setAgent(data.agent);
        setTools(data.tools);
        setAvailableTools(data.available_tools);

        // Populate form
        setName(data.agent.name);
        setDescription(data.agent.description || "");
        setVoiceId(data.agent.voice_id);
        setSystemPrompt(data.agent.system_prompt);
        setFirstMessage(data.agent.first_message || "");
        setIsActive(data.agent.is_active);

        // Set selected tools
        const enabledTools = new Set(
          data.tools
            .filter((t: AgentTool) => t.is_enabled)
            .map((t: AgentTool) => t.tool_key)
        );
        setSelectedTools(enabledTools);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load agent");
      } finally {
        setLoading(false);
      }
    };

    fetchAgent();
  }, [id]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    const toastId = toast.loading("Saving agent...");

    try {
      // Step 1: Save to database
      const res = await fetch(`/api/elevenlabs/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          voice_id: voiceId,
          system_prompt: systemPrompt,
          first_message: firstMessage || null,
          is_active: isActive,
          tool_keys: Array.from(selectedTools),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save agent");
      }

      toast.loading("Syncing to ElevenLabs...", { id: toastId });

      // Step 2: Auto-sync to ElevenLabs
      const syncRes = await fetch(`/api/elevenlabs/agents/${id}/sync`, {
        method: "POST",
      });

      if (!syncRes.ok) {
        const syncData = await syncRes.json().catch(() => ({}));
        throw new Error(syncData.error || "Failed to sync to ElevenLabs");
      }

      const syncData = await syncRes.json();
      const action = syncData.action === "created" ? "Created" : "Updated";

      toast.success(`${action} agent in ElevenLabs`, { id: toastId });

      // Refresh agent data to get the elevenlabs_agent_id
      const agentRes = await fetch(`/api/elevenlabs/agents/${id}`);
      if (agentRes.ok) {
        const agentData = await agentRes.json();
        setAgent(agentData.agent);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save agent", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this agent? This will also delete it from ElevenLabs.")) {
      return;
    }

    const toastId = toast.loading("Deleting agent...");

    try {
      const res = await fetch(`/api/elevenlabs/agents/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete agent");
      }

      toast.success("Agent deleted", { id: toastId });
      router.push("/admin/agent-flow");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete agent", { id: toastId });
    }
  };

  const toggleTool = (toolKey: string) => {
    const newSelected = new Set(selectedTools);
    if (newSelected.has(toolKey)) {
      newSelected.delete(toolKey);
    } else {
      newSelected.add(toolKey);
    }
    setSelectedTools(newSelected);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 text-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-4xl mx-auto py-8 text-center text-muted-foreground">
        Agent not found
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/admin/agent-flow"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Link>

        <div className="flex items-center gap-2">
          {agent.elevenlabs_agent_id && (
            <>
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Synced
              </span>
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a
                  href={`https://elevenlabs.io/app/conversational-ai/agents/${agent.elevenlabs_agent_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Test
                </a>
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Agent Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voice">Voice</Label>
                <Select value={voiceId} onValueChange={setVoiceId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICES.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </CardContent>
        </Card>

        {/* System Prompt */}
        <Card>
          <CardHeader>
            <CardTitle>System Prompt</CardTitle>
            <CardDescription>
              Instructions for the agent. This defines its personality and behavior.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={8}
                placeholder="You are a helpful assistant..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="firstMessage">First Message</Label>
              <Input
                id="firstMessage"
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                placeholder="Hello, how can I help you today?"
              />
              <p className="text-sm text-muted-foreground">
                The agent&apos;s greeting when a conversation starts.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tools */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Tools
            </CardTitle>
            <CardDescription>
              Select which tools this agent can access. Tools allow the agent to
              fetch data from your system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {availableTools.map((tool) => (
                <div
                  key={tool.tool_key}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleTool(tool.tool_key)}
                >
                  <Checkbox
                    checked={selectedTools.has(tool.tool_key)}
                    onCheckedChange={() => toggleTool(tool.tool_key)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{tool.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {tool.description}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Scopes: {tool.supported_scopes.join(", ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="text-sm text-muted-foreground">
              {selectedTools.size} tool{selectedTools.size !== 1 ? "s" : ""}{" "}
              selected
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

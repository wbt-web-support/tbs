"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, PanelRightOpen, Settings } from "lucide-react";
import { getNodeDefinition } from "@/lib/chatbot-flow/nodes";
import { FlowCanvas } from "../../components/FlowCanvas";
import { NodesSidebar } from "../../components/NodesSidebar";
import { TestChatInline } from "../../components/TestChatInline";
import { NodeEditor } from "../../node-editors";

type LinkedNode = {
  id: string;
  node_key: string;
  name: string;
  node_type: string;
  settings: Record<string, unknown>;
  order_index: number;
  link_id?: string;
};

type Chatbot = {
  id: string;
  name: string;
  base_prompt: string;
  is_active: boolean;
  model_name: string | null;
};

export default function EditChatbotPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [linkedNodes, setLinkedNodes] = useState<LinkedNode[]>([]);
  const [name, setName] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [modelName, setModelName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nodesOpen, setNodesOpen] = useState(true);
  const [editNode, setEditNode] = useState<LinkedNode | null>(null);
  const [editSettings, setEditSettings] = useState<Record<string, unknown>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [addingNodeKey, setAddingNodeKey] = useState<string | null>(null);

  const fetchChatbot = useCallback(async () => {
    const res = await fetch(`/api/chatbot-flow/chatbots/${id}`);
    if (!res.ok) {
      setError("Chatbot not found");
      setChatbot(null);
      return;
    }
    const data = await res.json();
    setChatbot(data);
    setName(data.name);
    setBasePrompt(data.base_prompt ?? "");
    setModelName(data.model_name ?? "");
  }, [id]);

  const fetchLinkedNodes = useCallback(async () => {
    const res = await fetch(`/api/chatbot-flow/chatbots/${id}/nodes`);
    if (!res.ok) return;
    const data = await res.json();
    setLinkedNodes(data.nodes ?? []);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([fetchChatbot(), fetchLinkedNodes()]).finally(() => setLoading(false));
  }, [id, fetchChatbot, fetchLinkedNodes]);

  const handleSaveChatbot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatbot) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/chatbot-flow/chatbots/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          base_prompt: basePrompt,
          model_name: modelName.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      setSettingsOpen(false);
      await fetchChatbot();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAddNode = useCallback(
    async (nodeKey: string, position?: { x: number; y: number }) => {
      if (!nodeKey) return;
      setError(null);
      setAddingNodeKey(nodeKey);
      try {
        const body: { node_key: string; position?: { x: number; y: number } } = { node_key: nodeKey };
        if (position) body.position = position;
        const res = await fetch(`/api/chatbot-flow/chatbots/${id}/nodes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to add node");
        }
        const def = getNodeDefinition(nodeKey);
        const newOrderIndex = linkedNodes.length;
        const newSettings = position
          ? { ...def?.defaultSettings, position }
          : (def?.defaultSettings ?? {});
        const newNode: LinkedNode = {
          id: nodeKey,
          node_key: nodeKey,
          name: def?.name ?? nodeKey,
          node_type: def?.nodeType ?? "data_access",
          settings: newSettings,
          order_index: newOrderIndex,
        };
        setLinkedNodes((prev) => [...prev, newNode]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add node");
        await fetchLinkedNodes();
      } finally {
        setAddingNodeKey(null);
      }
    },
    [id, linkedNodes.length, fetchLinkedNodes]
  );

  const handleRemoveNode = useCallback(
    async (nodeKey: string) => {
      try {
        const res = await fetch(`/api/chatbot-flow/chatbots/${id}/nodes/${nodeKey}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to remove");
        setEditNode((prev) => (prev?.node_key === nodeKey ? null : prev));
        await fetchLinkedNodes();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove node");
      }
    },
    [id, fetchLinkedNodes]
  );

  const openEdit = useCallback((node: LinkedNode) => {
    setEditNode(node);
    setEditSettings(node.settings ?? {});
  }, []);

  const handleSaveSettings = async () => {
    if (!editNode) return;
    const nodeKey = editNode.node_key;
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/chatbot-flow/chatbots/${id}/nodes/${nodeKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: editSettings }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setEditNode(null);
      await fetchLinkedNodes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePositionChange = useCallback(
    async (nodeKey: string, position: { x: number; y: number }) => {
      try {
        // Find the node to get its current settings
        const node = linkedNodes.find((n) => n.node_key === nodeKey);
        if (!node) return;

        // Merge position into settings
        const updatedSettings = { ...node.settings, position };

        const res = await fetch(`/api/chatbot-flow/chatbots/${id}/nodes/${nodeKey}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: updatedSettings }),
        });
        if (!res.ok) throw new Error("Failed to save position");

        // Update local state immediately for responsive UI
        setLinkedNodes((prevNodes) =>
          prevNodes.map((n) => (n.node_key === nodeKey ? { ...n, settings: updatedSettings } : n))
        );
      } catch (e) {
        console.error("Failed to save node position:", e);
        setError(e instanceof Error ? e.message : "Failed to save position");
      }
    },
    [id, linkedNodes]
  );

  const attachedKeys = new Set(linkedNodes.map((n) => n.node_key));

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }
  if (!chatbot) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Chatbot not found.</p>
        <Link href="/admin/chatbot-flow">
          <Button variant="outline">Back to Chatbot Flow</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-70px)] bg-background">
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href="/admin/chatbot-flow"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground shrink-0 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <span className="text-border">/</span>
          <h1 className="font-semibold text-base truncate">{chatbot.name}</h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {error && (
            <span className="text-sm text-destructive truncate max-w-[200px]" title={error}>
              {error}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4 mr-1.5" />
            Settings
          </Button>
        </div>
      </header>

      {/* Main: canvas | nodes (closable) | context + chat on the right */}
      <div className="flex-1 flex min-h-0 overflow-hidden" style={{ minHeight: 320 }}>
        <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-muted/20 relative">
          <FlowCanvas
            chatbotName={chatbot.name}
            linkedNodes={linkedNodes}
            onAddNode={handleAddNode}
            onEditNode={openEdit}
            onRemoveNode={handleRemoveNode}
            onPositionChange={handlePositionChange}
          />
          {addingNodeKey && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span>Adding node...</span>
              </div>
            </div>
          )}
        </div>
        {nodesOpen ? (
          <NodesSidebar
            attachedKeys={attachedKeys}
            onClose={() => setNodesOpen(false)}
          />
        ) : (
          <div className="shrink-0 border-l border-border bg-card flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNodesOpen(true)}
              className="flex flex-col gap-1.5 h-auto py-4 px-3 rounded-none border-0"
              title="Open nodes panel"
            >
              <PanelRightOpen className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Nodes</span>
            </Button>
          </div>
        )}
        <div className="w-[580px] shrink-0 flex flex-col min-h-0 border-l border-border bg-card">
          <TestChatInline chatbotId={id} chatbotName={chatbot.name} />
        </div>
      </div>

      {/* Settings dialog (name, base prompt, model) */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chatbot settings</DialogTitle>
            <DialogDescription>
              Update name, base prompt, and model. These apply to the chatbot root.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveChatbot} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="base_prompt">Base prompt</Label>
              <Textarea
                id="base_prompt"
                value={basePrompt}
                onChange={(e) => setBasePrompt(e.target.value)}
                rows={4}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="model_name">Model name (optional)</Label>
              <Input
                id="model_name"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. gemini-2.5-flash"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit node settings dialog */}
      <Dialog open={!!editNode} onOpenChange={(open) => !open && setEditNode(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit: {editNode?.name}</DialogTitle>
            <DialogDescription>
              Change this node&apos;s settings. Each node type has its own edit UI.
            </DialogDescription>
          </DialogHeader>
          {editNode && (
            <div className="space-y-4">
              <NodeEditor
                nodeKey={editNode.node_key ?? editNode.id}
                settings={editSettings}
                onChange={setEditSettings}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditNode(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? "Saving..." : "Save settings"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
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
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  PanelRightOpen,
  Plus,
  Settings,
  Trash2,
  Upload,
  Link2,
  Sparkles,
  Save,
  X,
  Eye,
  MessageSquare,
  Workflow
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getNodeDefinition } from "@/lib/chatbot-flow/nodes";
import { NodesSidebar } from "../../components/NodesSidebar";
import { TestChatInline } from "../../components/TestChatInline";
import { NodeEditor } from "../../node-editors";
import { ChunkLoadErrorBoundary } from "../../components/ChunkLoadErrorBoundary";

function loadFlowCanvas() {
  return import("../../components/FlowCanvas").then((m) => ({ default: m.FlowCanvas }));
}

const FlowCanvas = dynamic(
  () =>
    loadFlowCanvas().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      const isChunkLoad =
        msg.includes("ChunkLoadError") || msg.includes("Loading chunk") || msg.includes("Loading CSS chunk");
      if (isChunkLoad) return loadFlowCanvas();
      throw err;
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Loading canvas...
      </div>
    ),
  }
);

type LinkedNode = {
  id: string;
  node_key: string;
  name: string;
  node_type: string;
  settings: Record<string, unknown>;
  order_index: number;
  link_id?: string;
};

type ExtractionMetadata = {
  extracted_text?: string;
  file_name?: string;
  file_size?: number;
  extraction_date?: string;
  loom_metadata?: {
    thumbnailUrl?: string;
    views?: number;
    createdAt?: string;
    owner?: string;
    duration_formatted?: string;
  };
};

type BasePromptEntry = {
  type: string;
  content: string;
  url?: string | null;
  document_url?: string | null;
  document_name?: string | null;
  extraction_metadata?: ExtractionMetadata | null;
};

type Chatbot = {
  id: string;
  name: string;
  base_prompts: BasePromptEntry[];
  is_active: boolean;
  model_name: string | null;
};

const PROMPT_TYPES = [
  { value: "text", label: "Text" },
  { value: "pdf", label: "PDF" },
  { value: "document", label: "Document" },
  { value: "sheet", label: "Sheet" },
  { value: "url", label: "URL" },
  { value: "loom", label: "Loom Video" },
] as const;

export default function EditChatbotPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [linkedNodes, setLinkedNodes] = useState<LinkedNode[]>([]);
  const [name, setName] = useState("");
  const [basePrompts, setBasePrompts] = useState<BasePromptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nodesOpen, setNodesOpen] = useState(true);
  const [editNode, setEditNode] = useState<LinkedNode | null>(null);
  const [editSettings, setEditSettings] = useState<Record<string, unknown>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [addingNodeKey, setAddingNodeKey] = useState<string | null>(null);
  const [extractingIndex, setExtractingIndex] = useState<number | null>(null);
  const [editContentIndex, setEditContentIndex] = useState<number | null>(null);
  const [editContentValue, setEditContentValue] = useState("");
  const [openBasePromptIndex, setOpenBasePromptIndex] = useState<number | null>(null);

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
    const prompts = Array.isArray(data.base_prompts)
      ? data.base_prompts.filter(
          (p: unknown): p is BasePromptEntry =>
            p != null && typeof (p as BasePromptEntry).content === "string"
        )
      : [];
    setBasePrompts(
      prompts.length > 0
        ? prompts.map((p: BasePromptEntry) => ({
            type: p.type || "text",
            content: p.content,
            url: p.url ?? undefined,
            document_url: p.document_url ?? undefined,
            document_name: p.document_name ?? undefined,
            extraction_metadata: p.extraction_metadata ?? undefined,
          }))
        : [{ type: "text", content: "" }]
    );
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
          base_prompts: basePrompts.filter((p) => p.content.trim() !== "").length > 0
            ? basePrompts
                .map((p) => ({
                  type: p.type || "text",
                  content: p.content.trim(),
                  ...(p.url != null && { url: p.url }),
                  ...(p.document_url != null && { document_url: p.document_url }),
                  ...(p.document_name != null && { document_name: p.document_name }),
                  ...(p.extraction_metadata != null && { extraction_metadata: p.extraction_metadata }),
                }))
                .filter((p) => Boolean(p.content))
            : [{ type: "text", content: "" }],
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

  const handleExtractFromUrl = useCallback(
    async (index: number, url: string, type: string) => {
      if (!url.trim()) {
        toast.error("Enter a URL first");
        return;
      }
      setExtractingIndex(index);
      try {
        let apiEndpoint = "";
        switch (type) {
          case "loom":
            apiEndpoint = "/api/extract/loom";
            break;
          case "url":
            apiEndpoint = "/api/extract/url";
            break;
          case "pdf":
            apiEndpoint = "/api/extract/pdf";
            break;
          case "sheet":
            apiEndpoint = "/api/extract/sheet";
            break;
          default:
            toast.error(`Extraction not supported for type: ${type}`);
            return;
        }
        const res = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed to extract" }));
          throw new Error(err.error || "Failed to extract");
        }
        const data = await res.json();
        const meta: ExtractionMetadata = {
          extracted_text: data.content,
          file_name: data.fileName ?? data.title ?? url.split("/").pop() ?? "unknown",
          extraction_date: data.extractionDate ?? new Date().toISOString(),
        };
        if (type === "loom" && (data.thumbnailUrl ?? data.views ?? data.createdAt ?? data.owner)) {
          meta.loom_metadata = {
            thumbnailUrl: data.thumbnailUrl,
            views: data.views,
            createdAt: data.createdAt,
            owner: typeof data.owner === "string" ? data.owner : data.owner?.name,
            duration_formatted:
              data.duration != null
                ? `${Math.floor(data.duration / 60)}:${String(Math.floor(data.duration) % 60).padStart(2, "0")} min`
                : undefined,
          };
        }
        setBasePrompts((prev) =>
          prev.map((p, i) =>
            i === index
              ? {
                  ...p,
                  content: data.content ?? "",
                  url: url.trim(),
                  extraction_metadata: meta,
                }
              : p
          )
        );
        toast.success("Content extracted successfully");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Extraction failed");
      } finally {
        setExtractingIndex(null);
      }
    },
    []
  );

  const handleFileUpload = useCallback(async (index: number, file: File, type: string) => {
    setExtractingIndex(index);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "other");
      formData.append("title", file.name.replace(/\.[^/.]+$/, ""));
      formData.append("instruction_type", type);
      const uploadRes = await fetch("/api/chatbot-flow/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploadData = await uploadRes.json();
      const documentUrl = uploadData.documentUrl as string;
      const documentName = (uploadData.documentName ?? uploadData.originalFileName ?? file.name) as string;

      const extractFormData = new FormData();
      extractFormData.append("file", file);
      const extractEndpoint =
        type === "pdf" ? "/api/extract/pdf" : type === "document" ? "/api/extract/doc" : "/api/extract/sheet";
      const extractRes = await fetch(extractEndpoint, { method: "POST", body: extractFormData });
      if (!extractRes.ok) throw new Error("Extraction failed");
      const extractData = await extractRes.json();
      const meta: ExtractionMetadata = {
        extracted_text: extractData.content,
        file_name: documentName,
        file_size: file.size,
        extraction_date: new Date().toISOString(),
      };
      setBasePrompts((prev) =>
        prev.map((p, i) =>
          i === index
            ? {
                ...p,
                content: extractData.content ?? "",
                document_url: documentUrl,
                document_name: documentName,
                extraction_metadata: meta,
              }
            : p
        )
      );
      toast.success("File uploaded and content extracted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload or extraction failed");
    } finally {
      setExtractingIndex(null);
    }
  }, []);

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
        const orderIndex = (data as { order_index?: number })?.order_index ?? linkedNodes.length;
        const newSettings = (data as { settings?: Record<string, unknown> })?.settings ?? (position
          ? { ...def?.defaultSettings, position }
          : (def?.defaultSettings ?? {}));
        const newNode: LinkedNode = {
          id: nodeKey,
          node_key: nodeKey,
          name: def?.name ?? nodeKey,
          node_type: def?.nodeType ?? "data_access",
          settings: newSettings,
          order_index: orderIndex,
        };
        setLinkedNodes((prev) => [...prev, newNode]);
        await fetchLinkedNodes();
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

  const handleReorderNodes = useCallback(
    (draggedKey: string, targetKey: string) => {
      const dragged = linkedNodes.find((n) => n.node_key === draggedKey);
      const target = linkedNodes.find((n) => n.node_key === targetKey);
      if (!dragged || !target || draggedKey === targetKey) return;

      const draggedOrder = dragged.order_index;
      const targetOrder = target.order_index;
      if (draggedOrder === targetOrder) return;

      setError(null);
      // Optimistic update: swap order in UI immediately
      setLinkedNodes((prev) =>
        prev.map((n) => {
          if (n.node_key === draggedKey) return { ...n, order_index: targetOrder };
          if (n.node_key === targetKey) return { ...n, order_index: draggedOrder };
          return n;
        })
      );
      toast.success("Order updated");

      // Persist in background; revert on failure
      Promise.all([
        fetch(`/api/chatbot-flow/chatbots/${id}/nodes/${draggedKey}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_index: targetOrder }),
        }),
        fetch(`/api/chatbot-flow/chatbots/${id}/nodes/${targetKey}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_index: draggedOrder }),
        }),
      ])
        .then(([resA, resB]) => {
          if (!resA.ok || !resB.ok) throw new Error("Failed to reorder");
          return fetchLinkedNodes();
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Failed to reorder");
          toast.error("Failed to reorder nodes");
          fetchLinkedNodes();
        });
    },
    [id, linkedNodes, fetchLinkedNodes]
  );

  const attachedKeys = new Set(linkedNodes.map((n) => n.node_key));

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-background via-background to-muted/20">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 animate-pulse">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <p className="text-lg font-medium text-muted-foreground animate-pulse">Loading chatbot editor...</p>
      </div>
    );
  }
  if (!chatbot) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-background via-background to-muted/20">
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-destructive/10">
          <Workflow className="h-10 w-10 text-destructive/60" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Chatbot Not Found</h2>
          <p className="text-muted-foreground">The chatbot you&apos;re looking for doesn&apos;t exist or has been removed.</p>
        </div>
        <Link href="/admin/chatbot-flow">
          <Button variant="default" size="lg" className="gap-2 shadow-sm">
            <ArrowLeft className="h-4 w-4" />
            Back to Chatbot Flow
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <ChunkLoadErrorBoundary>
      <div className="flex flex-col h-[calc(100vh-70px)] bg-gradient-to-br from-background via-background to-muted/20">
        {/* Modern Top Bar with Gradient */}
        <header className="shrink-0 flex items-center justify-between gap-6 px-6 py-4 border-b border-border/50 bg-card/95 backdrop-blur-sm shadow-sm">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/admin/chatbot-flow"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 shrink-0 transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 shrink-0">
                <Workflow className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="font-semibold text-lg truncate">{chatbot.name}</h1>
                <p className="text-xs text-muted-foreground">Chatbot Flow Editor</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {error && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
                <span className="text-sm text-destructive font-medium truncate max-w-[200px]" title={error}>
                  {error}
                </span>
              </div>
            )}
            <Button
              variant="outline"
              size="default"
              onClick={() => setSettingsOpen(true)}
              className="gap-2 font-medium shadow-sm hover:shadow transition-shadow"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>
        </header>

      {/* Main: canvas | nodes (closable) | context + chat on the right */}
      <div className="flex-1 flex min-h-0 overflow-hidden" style={{ minHeight: 320 }}>
        <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-gradient-to-br from-muted/30 via-background to-muted/20 relative">
          <FlowCanvas
            chatbotName={chatbot.name}
            linkedNodes={linkedNodes}
            onAddNode={handleAddNode}
            onEditNode={openEdit}
            onRemoveNode={handleRemoveNode}
            onReorderNodes={handleReorderNodes}
          />
          {addingNodeKey && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-4 px-8 py-6 rounded-2xl bg-card/95 border border-border shadow-2xl">
                <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10">
                  <Loader2 className="h-7 w-7 text-primary animate-spin" />
                </div>
                <span className="text-base font-medium text-foreground">Adding node...</span>
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
          <div className="shrink-0 border-l border-border/50 bg-card/95 backdrop-blur-sm flex items-center shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNodesOpen(true)}
              className="flex flex-col gap-2 h-auto py-6 px-4 rounded-none border-0 hover:bg-accent/50 transition-colors"
              title="Open nodes panel"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <PanelRightOpen className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground tracking-wide">NODES</span>
            </Button>
          </div>
        )}
        <div className="w-[680px] shrink-0 flex flex-col min-h-0 border-l border-border/50 bg-card/95 backdrop-blur-sm shadow-lg">
          <TestChatInline chatbotId={id} chatbotName={chatbot.name} />
        </div>
      </div>

      {/* Modern Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-[1400px] w-full max-h-[95vh] p-0 gap-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-8 py-5 border-b bg-gradient-to-r from-card to-muted/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Chatbot Settings</DialogTitle>
                <DialogDescription className="text-sm mt-1">
                  Configure your chatbot name and knowledge base prompts
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={handleSaveChatbot} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="px-8 py-6 space-y-5 border-b bg-card/50 shrink-0">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Chatbot Name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter a descriptive name for your chatbot"
                  className="h-11 text-base font-medium"
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto px-8 py-6 bg-muted/10">
              <div className="mb-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      Knowledge Base Prompts
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add multiple prompts with different content types to train your chatbot
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    size="default"
                    onClick={() => {
                      setBasePrompts((prev) => {
                        const next = [...prev, { type: "text", content: "" }];
                        setOpenBasePromptIndex(next.length - 1);
                        return next;
                      });
                    }}
                    className="gap-2 shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Add New Prompt
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                {basePrompts.length === 0 ? (
                  <div className="text-center py-16 px-6 rounded-xl border-2 border-dashed border-border bg-card/50">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h4 className="text-lg font-semibold mb-2">No prompts yet</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Get started by adding your first knowledge base prompt
                    </p>
                    <Button
                      type="button"
                      onClick={() => {
                        setBasePrompts([{ type: "text", content: "" }]);
                        setOpenBasePromptIndex(0);
                      }}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Your First Prompt
                    </Button>
                  </div>
                ) : (
                  basePrompts.map((entry, index) => {
                    const needsUrl =
                      entry.type !== "text" &&
                      entry.type !== "document" &&
                      entry.type !== "sheet";
                    const needsFile =
                      entry.type === "pdf" ||
                      entry.type === "document" ||
                      entry.type === "sheet";
                    const isExtracting = extractingIndex === index;
                    const meta = entry.extraction_metadata;
                    const isOpen = openBasePromptIndex === index;
                    const typeLabel = PROMPT_TYPES.find((t) => t.value === (entry.type || "text"))?.label ?? entry.type ?? "Text";
                    const preview =
                      entry.content.trim().length > 0
                        ? entry.content.trim().length > 50
                          ? `${entry.content.trim().slice(0, 50).replace(/\n/g, " ")}…`
                          : entry.content.trim().replace(/\n/g, " ")
                        : entry.url
                          ? entry.url.slice(0, 40) + (entry.url.length > 40 ? "…" : "")
                          : entry.document_name
                            ? `📄 ${entry.document_name}`
                            : "Empty prompt";
                    return (
                      <Card
                        key={index}
                        className={`overflow-hidden transition-all duration-200 ${
                          isOpen
                            ? "shadow-lg border-primary/30 ring-2 ring-primary/10"
                            : "shadow-sm hover:shadow-md border-border"
                        }`}
                      >
                        {/* Header: always visible, click to expand/collapse */}
                        <div
                          className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-accent/30 transition-colors"
                          onClick={() => setOpenBasePromptIndex((prev) => (prev === index ? null : index))}
                        >
                          <button
                            type="button"
                            className="shrink-0 p-1.5 rounded-md hover:bg-accent transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenBasePromptIndex((prev) => (prev === index ? null : index));
                            }}
                            aria-expanded={isOpen}
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4 text-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                          <Badge variant="secondary" className="shrink-0 px-3 py-1 text-xs font-semibold">
                            {typeLabel}
                          </Badge>
                          <span className="text-sm text-foreground truncate flex-1 min-w-0 font-medium" title={preview}>
                            {preview}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBasePrompts((prev) => prev.filter((_, i) => i !== index));
                              setOpenBasePromptIndex((prev) => (prev === index ? null : prev === null ? null : prev > index ? prev - 1 : prev));
                            }}
                            title="Remove prompt"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Body: only when open */}
                        {isOpen && (
                          <div className="border-t border-border p-6 space-y-5 bg-gradient-to-b from-muted/10 to-background">
                            <div className="flex items-center justify-between gap-3 pb-3 border-b">
                              <Label className="text-sm font-semibold">Prompt Type</Label>
                              <Select
                                value={entry.type || "text"}
                                onValueChange={(v) =>
                                  setBasePrompts((prev) =>
                                    prev.map((p, i) => (i === index ? { ...p, type: v } : p))
                                  )
                                }
                              >
                                <SelectTrigger className="w-[160px] h-10">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PROMPT_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                      {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {needsUrl && (
                              <div className="rounded-xl border border-border p-4 space-y-3 bg-accent/30">
                                <Label className="text-sm font-semibold flex items-center gap-2">
                                  <Link2 className="h-4 w-4 text-primary" />
                                  Resource URL
                                </Label>
                                <div className="flex gap-2">
                                  <Input
                                    value={entry.url ?? ""}
                                    onChange={(e) =>
                                      setBasePrompts((prev) =>
                                        prev.map((p, i) =>
                                          i === index ? { ...p, url: e.target.value } : p
                                        )
                                      )
                                    }
                                    placeholder="https://example.com/resource"
                                    className="flex-1 h-11"
                                  />
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="default"
                                    onClick={() =>
                                      handleExtractFromUrl(index, entry.url ?? "", entry.type)
                                    }
                                    disabled={!entry.url?.trim() || isExtracting}
                                    className="whitespace-nowrap gap-2 min-w-[130px]"
                                  >
                                    {isExtracting ? (
                                      <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Extracting...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="h-4 w-4" />
                                        Extract
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            )}

                            {needsFile && (
                              <div className="rounded-xl border border-border p-4 space-y-3 bg-accent/30">
                                <Label className="text-sm font-semibold flex items-center gap-2">
                                  <Upload className="h-4 w-4 text-primary" />
                                  Upload File
                                </Label>
                                <Input
                                  type="file"
                                  accept={
                                    entry.type === "pdf"
                                      ? ".pdf"
                                      : entry.type === "sheet"
                                        ? ".csv,.xlsx,.xls"
                                        : ".doc,.docx,.odt"
                                  }
                                  className="h-11 cursor-pointer"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file)
                                      handleFileUpload(index, file, entry.type);
                                    e.target.value = "";
                                  }}
                                  disabled={isExtracting}
                                />
                                {(entry.document_url ?? entry.document_name) && (
                                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <p className="text-sm text-foreground font-medium">
                                      {entry.document_name ?? "document"}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label className="text-sm font-semibold flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                Prompt Content
                                <span className="text-xs text-muted-foreground font-normal">
                                  (Used in system prompt)
                                </span>
                              </Label>
                              <Textarea
                                value={entry.content}
                                onChange={(e) =>
                                  setBasePrompts((prev) =>
                                    prev.map((p, i) =>
                                      i === index ? { ...p, content: e.target.value } : p
                                    )
                                  )
                                }
                                placeholder={
                                  entry.type === "text"
                                    ? "Enter your prompt content here..."
                                    : "Extract from URL or upload a file to auto-fill, or type manually."
                                }
                                rows={8}
                                className="resize-y min-h-[160px] font-mono text-sm border-2 focus:border-primary/50"
                              />
                            </div>

                            {meta && (
                              <div className="rounded-xl border border-border p-4 space-y-3 bg-gradient-to-br from-primary/5 to-primary/10">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-semibold flex items-center gap-2">
                                    <Eye className="h-4 w-4 text-primary" />
                                    Extraction Details
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-2"
                                    onClick={() => {
                                      setEditContentValue(entry.content);
                                      setEditContentIndex(index);
                                    }}
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                    Edit Content
                                  </Button>
                                </div>
                                <Separator />
                                {meta.extraction_date && (
                                  <p className="text-xs text-muted-foreground">
                                    <span className="font-semibold">Extracted:</span>{" "}
                                    {new Date(meta.extraction_date).toLocaleString()}
                                  </p>
                                )}
                                {meta.file_name && (
                                  <p className="text-xs text-muted-foreground">
                                    <span className="font-semibold">File:</span> {meta.file_name}
                                  </p>
                                )}
                                {meta.loom_metadata && (
                                  <div className="flex flex-wrap gap-3 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                                    {meta.loom_metadata.views != null && (
                                      <span><strong>Views:</strong> {meta.loom_metadata.views}</span>
                                    )}
                                    {meta.loom_metadata.duration_formatted && (
                                      <span><strong>Duration:</strong> {meta.loom_metadata.duration_formatted}</span>
                                    )}
                                    {meta.loom_metadata.owner && (
                                      <span><strong>Owner:</strong> {meta.loom_metadata.owner}</span>
                                    )}
                                    {meta.loom_metadata.createdAt && (
                                      <span>
                                        <strong>Created:</strong>{" "}
                                        {new Date(meta.loom_metadata.createdAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {(meta.extracted_text ?? entry.content) && (
                                  <div className="mt-2 p-3 rounded-lg bg-background/50 border border-border/50">
                                    <p className="text-xs text-muted-foreground line-clamp-3 break-words">
                                      {(meta.extracted_text ?? entry.content).substring(0, 250)}
                                      {(meta.extracted_text ?? entry.content).length > 250 ? "..." : ""}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modern Edit Extracted Content Dialog */}
            <Dialog
              open={editContentIndex !== null}
              onOpenChange={(open) => {
                if (!open) {
                  setEditContentIndex(null);
                  setEditContentValue("");
                }
              }}
            >
              <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-8 py-5 border-b bg-gradient-to-r from-card to-muted/30 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl">Edit Prompt Content</DialogTitle>
                      <DialogDescription className="text-sm mt-1">
                        Modify the content that will be used in your chatbot&apos;s system prompt
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="flex-1 min-h-0 p-8 overflow-hidden flex flex-col">
                  <Textarea
                    value={editContentValue}
                    onChange={(e) => setEditContentValue(e.target.value)}
                    className="flex-1 min-h-[50vh] font-mono text-sm resize-none border-2 focus:border-primary/50"
                    placeholder="Enter your prompt content here..."
                  />
                  <div className="flex items-center justify-between gap-4 pt-6 mt-auto">
                    <p className="text-sm text-muted-foreground">
                      {editContentValue.length} characters
                    </p>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="default"
                        onClick={() => {
                          setEditContentIndex(null);
                          setEditContentValue("");
                        }}
                        className="min-w-[100px] gap-2"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="default"
                        onClick={() => {
                          if (editContentIndex !== null) {
                            setBasePrompts((prev) =>
                              prev.map((p, i) =>
                                i === editContentIndex
                                  ? { ...p, content: editContentValue }
                                  : p
                              )
                            );
                            setEditContentIndex(null);
                            setEditContentValue("");
                            toast.success("Content updated successfully");
                          }
                        }}
                        className="min-w-[120px] gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <div className="px-8 py-5 border-t bg-gradient-to-r from-card to-muted/20 flex justify-between items-center gap-4 shrink-0">
              <p className="text-sm text-muted-foreground">
                {basePrompts.length} prompt{basePrompts.length !== 1 ? "s" : ""} configured
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() => setSettingsOpen(false)}
                  className="min-w-[100px] gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  size="default"
                  className="min-w-[120px] gap-2 shadow-sm"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modern Edit Node Settings Dialog */}
      <Dialog open={!!editNode} onOpenChange={(open) => !open && setEditNode(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Edit Node: {editNode?.name}</DialogTitle>
                <DialogDescription className="text-sm mt-1">
                  Configure this node&apos;s settings and behavior
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {editNode && (
            <div className="space-y-6 py-4">
              <div className="rounded-lg border border-border p-4 bg-muted/20">
                <NodeEditor
                  nodeKey={editNode.node_key ?? editNode.id}
                  settings={editSettings}
                  onChange={setEditSettings}
                />
              </div>
              <Separator />
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => setEditNode(null)}
                  className="min-w-[100px] gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  size="default"
                  className="min-w-[120px] gap-2"
                >
                  {savingSettings ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      </div>
    </ChunkLoadErrorBoundary>
  );
}

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
import { ArrowLeft, ChevronDown, ChevronRight, FileText, Loader2, PanelRightOpen, Plus, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [extractingIndex, setExtractingIndex] = useState<number | null>(null);
  const [editContentIndex, setEditContentIndex] = useState<number | null>(null);
  const [editContentValue, setEditContentValue] = useState("");
  const [openBasePromptIndex, setOpenBasePromptIndex] = useState<number | null>(0);

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
    <ChunkLoadErrorBoundary>
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
        <div className="w-[680px] shrink-0 flex flex-col min-h-0 border-l border-border bg-card">
          <TestChatInline chatbotId={id} chatbotName={chatbot.name} />
        </div>
      </div>

      {/* Settings dialog: full width/height, name, multiple base prompts (type + content), model */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-[1500px] w-full max-h-[100vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>Chatbot settings</DialogTitle>
            <DialogDescription>
              Update name, base prompts (add multiple with type), and model.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveChatbot} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="px-6 py-4 space-y-4 border-b shrink-0">
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
                <Label htmlFor="model_name">Model name (optional)</Label>
                <Input
                  id="model_name"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g. gemini-2.5-flash"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <Label>Base prompts</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBasePrompts((prev) => {
                      const next = [...prev, { type: "text", content: "" }];
                      setOpenBasePromptIndex(next.length - 1);
                      return next;
                    });
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add prompt
                </Button>
              </div>
              <div className="space-y-2">
                {basePrompts.map((entry, index) => {
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
                          : "Empty";
                  return (
                    <div
                      key={index}
                      className="rounded-lg border border-border bg-card overflow-hidden"
                    >
                      {/* Header: always visible, click to expand/collapse */}
                      <div
                        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors min-h-0"
                        onClick={() => setOpenBasePromptIndex((prev) => (prev === index ? null : index))}
                      >
                        <button
                          type="button"
                          className="shrink-0 p-0.5 rounded hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenBasePromptIndex((prev) => (prev === index ? null : index));
                          }}
                          aria-expanded={isOpen}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                        <span className="text-xs font-medium text-muted-foreground shrink-0 w-[100px]">
                          {typeLabel}
                        </span>
                        <span className="text-xs text-foreground truncate flex-1 min-w-0" title={preview}>
                          {preview || "—"}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBasePrompts((prev) => prev.filter((_, i) => i !== index));
                            setOpenBasePromptIndex((prev) => (prev === index ? null : prev === null ? null : prev > index ? prev - 1 : prev));
                          }}
                          title="Remove prompt"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Body: only when open */}
                      {isOpen && (
                        <div className="border-t border-border p-4 space-y-3 bg-muted/5">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs text-muted-foreground">Prompt type</Label>
                            <Select
                              value={entry.type || "text"}
                              onValueChange={(v) =>
                                setBasePrompts((prev) =>
                                  prev.map((p, i) => (i === index ? { ...p, type: v } : p))
                                )
                              }
                            >
                              <SelectTrigger className="w-[140px] h-8">
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
                        <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
                          <Label className="text-xs">URL</Label>
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
                              placeholder="Enter resource URL"
                              className="flex-1 h-9"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleExtractFromUrl(index, entry.url ?? "", entry.type)
                              }
                              disabled={!entry.url?.trim() || isExtracting}
                              className="whitespace-nowrap h-9"
                            >
                              {isExtracting ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                  Extracting
                                </>
                              ) : (
                                "Extract"
                              )}
                            </Button>
                          </div>
                        </div>
                      )}

                      {needsFile && (
                        <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
                          <Label className="text-xs">Upload file</Label>
                          <Input
                            type="file"
                            accept={
                              entry.type === "pdf"
                                ? ".pdf"
                                : entry.type === "sheet"
                                  ? ".csv,.xlsx,.xls"
                                  : ".doc,.docx,.odt"
                            }
                            className="h-9"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file)
                                handleFileUpload(index, file, entry.type);
                              e.target.value = "";
                            }}
                            disabled={isExtracting}
                          />
                          {(entry.document_url ?? entry.document_name) && (
                            <p className="text-xs text-muted-foreground">
                              Uploaded: {entry.document_name ?? "document"}
                            </p>
                          )}
                        </div>
                      )}

                      <div>
                        <Label className="text-xs text-muted-foreground">Content (used in system prompt)</Label>
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
                              ? "Enter prompt content..."
                              : "Use Extract or upload a file to fill content, or type manually."
                          }
                          rows={6}
                          className="resize-y min-h-[120px] font-mono text-sm mt-1"
                        />
                      </div>

                      {meta && (
                        <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                              Extracted content
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setEditContentValue(entry.content);
                                setEditContentIndex(index);
                              }}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Edit content
                            </Button>
                          </div>
                          {meta.extraction_date && (
                            <p className="text-xs text-muted-foreground">
                              Extracted:{" "}
                              {new Date(meta.extraction_date).toLocaleString()}
                            </p>
                          )}
                          {meta.file_name && (
                            <p className="text-xs text-muted-foreground">
                              File: {meta.file_name}
                            </p>
                          )}
                          {meta.loom_metadata && (
                            <div className="flex flex-wrap gap-3 pt-1 border-t border-border text-xs text-muted-foreground">
                              {meta.loom_metadata.views != null && (
                                <span>Views: {meta.loom_metadata.views}</span>
                              )}
                              {meta.loom_metadata.duration_formatted && (
                                <span>Duration: {meta.loom_metadata.duration_formatted}</span>
                              )}
                              {meta.loom_metadata.owner && (
                                <span>Owner: {meta.loom_metadata.owner}</span>
                              )}
                              {meta.loom_metadata.createdAt && (
                                <span>
                                  Created:{" "}
                                  {new Date(meta.loom_metadata.createdAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          )}
                          {(meta.extracted_text ?? entry.content) && (
                            <p className="text-xs text-muted-foreground line-clamp-3 break-words mt-1">
                              {(meta.extracted_text ?? entry.content).substring(0, 200)}
                              {(meta.extracted_text ?? entry.content).length > 200 ? "…" : ""}
                            </p>
                          )}
                        </div>
                      )}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Edit extracted content dialog */}
            <Dialog
              open={editContentIndex !== null}
              onOpenChange={(open) => {
                if (!open) {
                  setEditContentIndex(null);
                  setEditContentValue("");
                }
              }}
            >
              <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Edit content</DialogTitle>
                  <DialogDescription>
                    Change the content used in the system prompt for this base prompt.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  value={editContentValue}
                  onChange={(e) => setEditContentValue(e.target.value)}
                  className="min-h-[50vh] font-mono text-sm resize-y"
                  placeholder="Content..."
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditContentIndex(null);
                      setEditContentValue("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
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
                        toast.success("Content updated");
                      }
                    }}
                  >
                    Save changes
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <div className="px-6 py-4 border-t flex justify-end gap-2 shrink-0">
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
    </ChunkLoadErrorBoundary>
  );
}

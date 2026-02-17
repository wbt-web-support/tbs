"use client";

import { useState, useEffect } from "react";
import PromptEditModal from "./PromptEditModal";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { PROMPT_KEY_TO_MODEL_CONFIG, type AiConfigKey } from "@/lib/ai-config";
import { cn } from "@/lib/utils";

type ModelOption = { id: string; name?: string };

function formatPromptTitle(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default function PromptTable({ prompts }: { prompts: any[] }) {
  const [editingPrompt, setEditingPrompt] = useState<any | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [models, setModels] = useState<ModelOption[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [savingModel, setSavingModel] = useState<string | null>(null);
  const [openModelPopover, setOpenModelPopover] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/ai-config")
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("Failed to load")))
      .then((data) => {
        if (cancelled) return;
        setConfig((data.config ?? {}) as Record<string, string>);
        setModels(data.models ?? []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load AI model config");
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const modelConfigKey = (promptKey: string): AiConfigKey | undefined =>
    PROMPT_KEY_TO_MODEL_CONFIG[promptKey];

  const handleModelChange = async (configKey: AiConfigKey, modelId: string) => {
    setSavingModel(configKey);
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [configKey]: modelId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setConfig((prev) => ({ ...prev, [configKey]: modelId }));
      toast.success("Model saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save model");
    } finally {
      setSavingModel(null);
    }
  };

  const getOptions = (promptKey: string): ModelOption[] => {
    const key = modelConfigKey(promptKey);
    if (!key) return [];
    const current = (config[key] ?? "").trim();
    const inList = models.some((m) => m.id === current);
    if (!current || inList) return models;
    return [{ id: current, name: current }, ...models];
  };

  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-2">
      {prompts.map((prompt) => {
        const configKey = modelConfigKey(prompt.prompt_key);
        const showModel = !!configKey && !configLoading;
        const options = getOptions(prompt.prompt_key);
        const value = configKey ? ((config[configKey] ?? "").trim() || undefined) : undefined;

        return (
          <div
            key={prompt.id}
            className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-2 relative min-h-[220px]"
          >
            <span className="text-lg font-medium text-neutral-900">
              {formatPromptTitle(prompt.prompt_key)}
            </span>
            <div className="text-sm text-neutral-700 mb-1">{prompt.description}</div>

            {showModel && (
              <div className="space-y-1.5 mb-2">
                <Label className="text-xs text-gray-500">Model (OpenRouter)</Label>
                {savingModel === configKey ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </div>
                ) : (
                  <Popover
                    open={openModelPopover === `${prompt.id}_${configKey}`}
                    onOpenChange={(open) => {
                      setOpenModelPopover(open ? `${prompt.id}_${configKey}` : null);
                      if (!open) setModelSearch("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-left",
                          "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        )}
                      >
                        <span className="truncate">
                          {value ? (options.find((m) => m.id === value)?.name || value) : "Select model"}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="min-w-[16rem] w-80 p-0" align="start">
                      <div className="p-2 border-b border-gray-200">
                        <Input
                          placeholder="Search models..."
                          value={openModelPopover === `${prompt.id}_${configKey}` ? modelSearch : ""}
                          onChange={(e) => setModelSearch(e.target.value)}
                          className="h-9 text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-64 overflow-auto p-1">
                        {options
                          .filter((m) =>
                            (m.name || m.id).toLowerCase().includes(modelSearch.toLowerCase().trim())
                          )
                          .map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className={cn(
                                "w-full text-left px-2 py-2 rounded text-sm hover:bg-gray-100",
                                value === m.id && "bg-blue-50 text-blue-800"
                              )}
                              onClick={() => {
                                handleModelChange(configKey, m.id);
                                setOpenModelPopover(null);
                                setModelSearch("");
                              }}
                            >
                              {m.name || m.id}
                            </button>
                          ))}
                        {options.filter((m) =>
                          (m.name || m.id).toLowerCase().includes(modelSearch.toLowerCase().trim())
                        ).length === 0 && (
                          <p className="px-2 py-4 text-sm text-gray-500 text-center">No models match</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}

            <div className="relative flex-1 min-h-0">
              <pre className="bg-neutral-50 rounded-lg p-3 text-xs font-mono text-neutral-700 max-h-32 overflow-hidden whitespace-pre-line border border-gray-100">
                {prompt.prompt_text.slice(0, 300)}
                {prompt.prompt_text.length > 300 ? "..." : ""}
              </pre>
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
              <span className="text-xs text-neutral-400">
                Last updated: {new Date(prompt.updated_at).toLocaleString()}
              </span>
              <button
                className="bg-blue-600 text-white rounded-full px-5 py-1.5 text-sm font-medium hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={() => setEditingPrompt(prompt)}
              >
                Edit prompt
              </button>
            </div>
          </div>
        );
      })}
      {editingPrompt && (
        <PromptEditModal
          prompt={editingPrompt}
          onClose={() => setEditingPrompt(null)}
          onSaved={() => setEditingPrompt(null)}
        />
      )}
    </div>
  );
} 
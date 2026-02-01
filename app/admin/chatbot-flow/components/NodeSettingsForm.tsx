"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NODE_TYPES = [
  { value: "data_access", label: "Data access" },
  { value: "instructions", label: "Instructions" },
] as const;

const DATA_SOURCES = [
  "products",
  "business_info",
  "performance_sessions",
  "tasks",
  "playbooks",
  "machines",
  "team_leaves",
  "finance_files",
  "chat_history",
  "chatbot_instructions",
  "company_onboarding",
];

const SCOPES = [
  { value: "all", label: "All accounts (platform-wide)" },
  { value: "team_specific", label: "Team / business only" },
  { value: "user_specific", label: "Current user only" },
];

export type NodeFormState = {
  name: string;
  node_type: "data_access" | "instructions";
  settings: Record<string, unknown>;
};

type Props = {
  state: NodeFormState;
  onChange: (state: NodeFormState) => void;
};

export function NodeSettingsForm({ state, onChange }: Props) {
  const update = (partial: Partial<NodeFormState>) => {
    onChange({ ...state, ...partial });
  };
  const updateSettings = (key: string, value: unknown) => {
    onChange({
      ...state,
      settings: { ...state.settings, [key]: value },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="node-name">Name</Label>
        <Input
          id="node-name"
          value={state.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Team Products Access"
          className="mt-1"
        />
      </div>
      <div>
        <Label>Node type</Label>
        <Select
          value={state.node_type}
          onValueChange={(v) => update({ node_type: v as "data_access" | "instructions" })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NODE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.node_type === "data_access" && (
        <>
          <div>
            <Label>Data source</Label>
            <Select
              value={(state.settings.data_source as string) || "products"}
              onValueChange={(v) => updateSettings("data_source", v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {DATA_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Scope</Label>
            <Select
              value={(state.settings.scope as string) || "team_specific"}
              onValueChange={(v) => updateSettings("scope", v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include_archived"
              checked={Boolean(state.settings.include_archived)}
              onCheckedChange={(checked) => updateSettings("include_archived", !!checked)}
            />
            <Label htmlFor="include_archived" className="font-normal">
              Include archived (where applicable)
            </Label>
          </div>
        </>
      )}

      {state.node_type === "instructions" && (
        <>
          <div>
            <Label htmlFor="instructions-content">Content</Label>
            <Textarea
              id="instructions-content"
              value={(state.settings.content as string) || ""}
              onChange={(e) => updateSettings("content", e.target.value)}
              placeholder="Always be polite and professional..."
              rows={6}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="instructions-priority">Priority (higher = earlier in prompt)</Label>
            <Input
              id="instructions-priority"
              type="number"
              value={String(state.settings.priority ?? 0)}
              onChange={(e) => updateSettings("priority", e.target.value ? Number(e.target.value) : 0)}
              className="mt-1 w-24"
            />
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DATA_SOURCES = [
  "products",
  "business_info",
  "business_owner_instructions",
  "performance_sessions",
  "tasks",
  "playbooks",
  "machines",
  "team_leaves",
  "finance_files",
  "chat_history",
  "company_onboarding",
];

const SCOPES = [
  { value: "all", label: "All accounts (platform-wide)" },
  { value: "team_specific", label: "Team / business only" },
  { value: "user_specific", label: "Current user only" },
];

export type NodeFormState = {
  name: string;
  node_type: "data_access";
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

    </div>
  );
}

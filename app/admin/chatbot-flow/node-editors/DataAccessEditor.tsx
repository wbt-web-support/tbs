"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SCOPES = [
  { value: "all", label: "All accounts (platform-wide)" },
  { value: "team_specific", label: "Team / business only" },
  { value: "user_specific", label: "Current user only" },
] as const;

type Props = {
  settings: Record<string, unknown>;
  onChange: (settings: Record<string, unknown>) => void;
  dataSource: string; // read-only, from node definition
};

export function DataAccessEditor({ settings, onChange, dataSource }: Props) {
  const scope = (settings.scope as string) ?? "team_specific";

  const update = (key: string, value: unknown) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Data source: <strong>{dataSource}</strong> (defined in node file)
      </p>
      <div>
        <Label>Scope</Label>
        <Select value={scope} onValueChange={(v) => update("scope", v)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
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
    </div>
  );
}

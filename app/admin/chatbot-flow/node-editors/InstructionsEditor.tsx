"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  settings: Record<string, unknown>;
  onChange: (settings: Record<string, unknown>) => void;
};

export function InstructionsEditor({ settings, onChange }: Props) {
  const content = (settings.content as string) ?? "";

  const update = (key: string, value: unknown) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Custom instructions</Label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-1">
          This text is appended to the system prompt for this chatbot.
        </p>
        <Textarea
          value={content}
          onChange={(e) => update("content", e.target.value)}
          placeholder="e.g. Always respond in a friendly tone. Focus on actionable next steps."
          rows={6}
          className="mt-1 font-mono text-sm"
        />
      </div>
    </div>
  );
}

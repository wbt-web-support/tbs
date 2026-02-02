"use client";

type Props = {
  settings: Record<string, unknown>;
  onChange: (settings: Record<string, unknown>) => void;
};

export function WebSearchEditor({ settings, onChange }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Web search is controlled by the user. When they check &quot;Search web&quot; in the chat, the model can use Google Search to fetch current information.
      </p>
    </div>
  );
}

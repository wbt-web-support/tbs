"use client";

type Props = {
  settings: Record<string, unknown>;
  onChange: (settings: Record<string, unknown>) => void;
};

export function SttInputEditor({ settings, onChange }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        When this node is added, a mic button appears in the chat input. Users can tap to record, tap again to stop. Audio is transcribed via Gemini and placed in the text input.
      </p>
      <p className="text-sm text-muted-foreground">
        This is a lightweight alternative to the full Voice Interface node — no TTS or voice output, just speech-to-text input.
      </p>
    </div>
  );
}

"use client";

type Props = {
  settings: Record<string, unknown>;
  onChange: (settings: Record<string, unknown>) => void;
};

export function AttachmentsEditor({ settings, onChange }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        When this node is added, the chat UI shows an Attach button. Users can upload images (PNG, JPG, WebP), PDFs, or documents (DOCX); the model receives them with the message.
      </p>
    </div>
  );
}

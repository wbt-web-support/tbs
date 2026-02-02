import type { NodeDefinition } from "./types";

export const attachmentsNode: NodeDefinition = {
  key: "attachments",
  name: "Attachments",
  description:
    "Allow users to attach images, PDFs, and documents to their messages.\n\nWhen enabled, the chat UI shows an Attach button. Users can upload images (PNG, JPG, WebP), PDFs, or documents (DOCX); the model receives them with the message.",
  nodeType: "attachments",
  defaultSettings: {},
};

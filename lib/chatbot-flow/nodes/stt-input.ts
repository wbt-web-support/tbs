import type { NodeDefinition } from "./types";

export const sttInputNode: NodeDefinition = {
  key: "stt_input",
  name: "Voice Input (STT)",
  description:
    "Allow users to speak their messages using a microphone button. Speech is transcribed to text using Gemini and placed in the chat input.\n\nNo TTS or voice output — just a simple voice-to-text input method.",
  nodeType: "stt_input",
  defaultSettings: { enabled: true },
};

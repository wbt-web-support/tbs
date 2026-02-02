import type { NodeDefinition } from "./types";

export const voiceInterfaceNode: NodeDefinition = {
  key: "voice_interface",
  name: "Voice Interface",
  description:
    "Enable voice input (speech-to-text) and voice output (text-to-speech) using ElevenLabs.\n\nWhen enabled, users can record voice messages using their microphone (transcribed to text), and assistant responses can be played back as audio. Voice features are powered by ElevenLabs API.",
  nodeType: "voice_interface",
  defaultSettings: {
    tts_enabled: true,
    stt_enabled: true,
    voice_id: "EXAVITQu4vr4xnSDxMaL", // Bella voice
    auto_play_responses: false,
  },
};

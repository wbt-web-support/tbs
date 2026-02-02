"use client";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  settings: Record<string, unknown>;
  onChange: (settings: Record<string, unknown>) => void;
};

const VOICE_OPTIONS = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella (default)" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam" },
];

export function VoiceEditor({ settings, onChange }: Props) {
  const ttsEnabled = Boolean(settings.tts_enabled ?? true);
  const sttEnabled = Boolean(settings.stt_enabled ?? true);
  const voiceId = String(settings.voice_id ?? "EXAVITQu4vr4xnSDxMaL");
  const autoPlay = Boolean(settings.auto_play_responses ?? false);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enable voice input (speech-to-text) and voice output (text-to-speech) using ElevenLabs API.
        Users can record voice messages and play back assistant responses as audio.
      </p>

      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="tts_enabled"
            checked={ttsEnabled}
            onCheckedChange={(checked) => {
              onChange({ ...settings, tts_enabled: checked });
            }}
          />
          <Label htmlFor="tts_enabled" className="text-sm font-normal cursor-pointer">
            Enable Text-to-Speech (TTS) - Play assistant responses as audio
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="stt_enabled"
            checked={sttEnabled}
            onCheckedChange={(checked) => {
              onChange({ ...settings, stt_enabled: checked });
            }}
          />
          <Label htmlFor="stt_enabled" className="text-sm font-normal cursor-pointer">
            Enable Speech-to-Text (STT) - Record voice messages with microphone
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="voice_id" className="text-sm">
            Voice Selection
          </Label>
          <Select
            value={voiceId}
            onValueChange={(value) => {
              onChange({ ...settings, voice_id: value });
            }}
          >
            <SelectTrigger id="voice_id">
              <SelectValue placeholder="Select a voice" />
            </SelectTrigger>
            <SelectContent>
              {VOICE_OPTIONS.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  {voice.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose the voice for text-to-speech playback
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="auto_play_responses"
            checked={autoPlay}
            onCheckedChange={(checked) => {
              onChange({ ...settings, auto_play_responses: checked });
            }}
          />
          <Label htmlFor="auto_play_responses" className="text-sm font-normal cursor-pointer">
            Auto-play responses - Automatically play audio for new assistant messages
          </Label>
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
        <strong>Note:</strong> Voice features require the ELEVENLABS_API_KEY environment variable to be configured.
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, RotateCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

type MediaPlayerProps = {
  audioUrl: string;
  onEnded?: () => void;
};

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MediaPlayer({ audioUrl, onEnded }: MediaPlayerProps) {
  const {
    state,
    loadAndPlay,
    togglePlayPause,
    seek,
    skipForward,
    skipBackward,
  } = useAudioPlayer();

  const hasLoadedRef = useRef(false);

  // Load audio on mount
  useEffect(() => {
    if (!hasLoadedRef.current && audioUrl) {
      hasLoadedRef.current = true;
      loadAndPlay(audioUrl);
    }
  }, [audioUrl, loadAndPlay]);

  // Call onEnded when playback ends
  useEffect(() => {
    if (!state.isPlaying && state.currentTime > 0 && state.currentTime >= state.duration - 0.1) {
      onEnded?.();
    }
  }, [state.isPlaying, state.currentTime, state.duration, onEnded]);

  // Note: No cleanup needed here - useAudioPlayer handles its own cleanup
  // and the blob URL is managed by the parent component

  const handleProgressChange = (value: number[]) => {
    seek(value[0]);
  };

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <div className="bg-muted/30 border border-border rounded-lg p-3 mt-2 space-y-2">
      {state.error && (
        <div className="text-xs text-destructive">{state.error}</div>
      )}

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono w-12 text-right">
          {formatTime(state.currentTime)}
        </span>
        <Slider
          value={[state.currentTime]}
          max={state.duration || 100}
          step={0.1}
          onValueChange={handleProgressChange}
          className="flex-1"
          disabled={state.isLoading || !state.duration}
        />
        <span className="text-xs text-muted-foreground font-mono w-12">
          {formatTime(state.duration)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => skipBackward(5)}
          disabled={state.isLoading || !state.duration}
          className="h-8 w-8 p-0"
          title="Skip back 5 seconds"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlayPause}
          disabled={state.isLoading}
          className="h-9 w-9 p-0"
          title={state.isPlaying ? "Pause" : "Play"}
        >
          {state.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : state.isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => skipForward(5)}
          disabled={state.isLoading || !state.duration}
          className="h-8 w-8 p-0"
          title="Skip forward 5 seconds"
        >
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

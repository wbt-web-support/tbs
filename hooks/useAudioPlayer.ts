import { useCallback, useEffect, useRef, useState } from "react";

export type AudioPlayerState = {
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
};

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    error: null,
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src && audioRef.current.src.startsWith("blob:")) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        audioRef.current = null;
      }
    };
  }, []);

  // Load and play audio
  const loadAndPlay = useCallback(async (audioUrl: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Create or reuse audio element
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      const audio = audioRef.current;

      // Set up event listeners
      const handleTimeUpdate = () => {
        setState((prev) => ({ ...prev, currentTime: audio.currentTime }));
      };

      const handleLoadedMetadata = () => {
        setState((prev) => ({ ...prev, duration: audio.duration, isLoading: false }));
      };

      const handleEnded = () => {
        setState((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
      };

      const handleError = () => {
        setState((prev) => ({
          ...prev,
          error: "Failed to load audio",
          isLoading: false,
          isPlaying: false,
        }));
      };

      const handleCanPlay = () => {
        setState((prev) => ({ ...prev, isLoading: false }));
      };

      // Remove old listeners if any
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);

      // Add new listeners
      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("loadedmetadata", handleLoadedMetadata);
      audio.addEventListener("ended", handleEnded);
      audio.addEventListener("error", handleError);
      audio.addEventListener("canplay", handleCanPlay);

      // Load audio
      audio.src = audioUrl;
      audio.load();

      // Play
      await audio.play();
      setState((prev) => ({ ...prev, isPlaying: true }));
    } catch (error) {
      console.error("Audio playback error:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Playback failed",
        isLoading: false,
        isPlaying: false,
      }));
    }
  }, []);

  const play = useCallback(async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
      setState((prev) => ({ ...prev, isPlaying: true }));
    } catch (error) {
      console.error("Play error:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Playback failed",
        isPlaying: false,
      }));
    }
  }, []);

  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const togglePlayPause = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [state.isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(time, state.duration));
    setState((prev) => ({ ...prev, currentTime: audioRef.current!.currentTime }));
  }, [state.duration]);

  const skipForward = useCallback((seconds: number = 5) => {
    if (!audioRef.current) return;
    seek(state.currentTime + seconds);
  }, [state.currentTime, seek]);

  const skipBackward = useCallback((seconds: number = 5) => {
    if (!audioRef.current) return;
    seek(state.currentTime - seconds);
  }, [state.currentTime, seek]);

  const stop = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setState((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
  }, []);

  const reset = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src && audioRef.current.src.startsWith("blob:")) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current.src = "";
    }
    setState({
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      duration: 0,
      error: null,
    });
  }, []);

  return {
    state,
    loadAndPlay,
    play,
    pause,
    togglePlayPause,
    seek,
    skipForward,
    skipBackward,
    stop,
    reset,
  };
}

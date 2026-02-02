import { useEffect, useRef, useState } from "react";

export function useStreamingTTS(enabled: boolean = true) {
  const [isConnected, setIsConnected] = useState(true); // HTTP is always "connected"
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const nextStartTimeRef = useRef(0);
  const currentRequestRef = useRef<AbortController | null>(null);

  // Initialize AudioContext
  useEffect(() => {
    if (enabled && !audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      nextStartTimeRef.current = audioContextRef.current.currentTime;
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [enabled]);

  const queueAudioChunk = async (arrayBuffer: ArrayBuffer) => {
    if (!audioContextRef.current) return;

    const decodeStart = performance.now();
    const queueTime = audioContextRef.current.currentTime;
    const nextStartTimeBefore = nextStartTimeRef.current;
    try {
      const audioBuffer =
        await audioContextRef.current.decodeAudioData(arrayBuffer);
      const decodeEnd = performance.now();
      audioQueueRef.current.push(audioBuffer);

      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:29',message:'TTS_AUDIO: Chunk queued',data:{audioBufferDuration:audioBuffer.duration,queueLength:audioQueueRef.current.length,isPlaying:isPlayingRef.current,currentTime:audioContextRef.current.currentTime,nextStartTime:nextStartTimeRef.current,timeUntilNextStart:nextStartTimeRef.current - audioContextRef.current.currentTime},timestamp:Date.now(),sessionId:'tts-audio-debug',runId:'audio-break',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion

      // Start playback if not already playing
      if (!isPlayingRef.current) {
        const currentTime = audioContextRef.current.currentTime;
        // Fix timing continuity: if nextStartTime is in the past, reset it to currentTime
        // This prevents huge gaps when starting playback after a delay
        if (nextStartTimeRef.current < currentTime) {
          // #region agent log
          fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:50',message:'TTS_AUDIO: Resetting nextStartTime (was in past)',data:{oldNextStartTime:nextStartTimeRef.current,currentTime,gapMs:(currentTime-nextStartTimeRef.current)*1000},timestamp:Date.now(),sessionId:'tts-audio-debug',runId:'audio-break-fix',hypothesisId:'H2'})}).catch(()=>{});
          // #endregion
          nextStartTimeRef.current = currentTime;
        }
        const playbackStart = performance.now();
        // #region agent log
        fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:58',message:'TTS_AUDIO: Starting playback (queue was empty)',data:{queueLength:audioQueueRef.current.length,currentTime,nextStartTime:nextStartTimeRef.current},timestamp:Date.now(),sessionId:'tts-audio-debug',runId:'audio-break-fix',hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        playNextChunk();
      }
    } catch (error) {
      console.error("Error decoding audio:", error);
      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:45',message:'Audio decode error',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'tts-latency',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    }
  };

  const playNextChunk = () => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:59',message:'TTS_AUDIO: Queue empty - stopping playback',data:{queueLength:audioQueueRef.current.length,hasContext:!!audioContextRef.current,currentTime:audioContextRef.current?.currentTime,nextStartTime:nextStartTimeRef.current},timestamp:Date.now(),sessionId:'tts-audio-debug',runId:'audio-break',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);

    const audioBuffer = audioQueueRef.current.shift()!;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);

    // Calculate when to start this chunk
    const currentTime = audioContextRef.current.currentTime;
    const nextStartTimeBefore = nextStartTimeRef.current;
    const startTime = Math.max(currentTime, nextStartTimeRef.current);
    const gapBeforeStart = startTime - nextStartTimeBefore;
    const timeUntilStart = startTime - currentTime;

    // Schedule next chunk to start right after this one ends
    const chunkEndTime = startTime + audioBuffer.duration;
    nextStartTimeRef.current = chunkEndTime;

    // #region agent log
    fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:76',message:'TTS_AUDIO: Playing chunk',data:{audioDuration:audioBuffer.duration,currentTime,nextStartTimeBefore,startTime,gapBeforeStartMs:gapBeforeStart*1000,timeUntilStartMs:timeUntilStart*1000,chunkEndTime,queueLengthAfterShift:audioQueueRef.current.length,willHaveGap:gapBeforeStart>0.01},timestamp:Date.now(),sessionId:'tts-audio-debug',runId:'audio-break',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    // When this chunk ends, play the next one
    source.onended = () => {
      const endedTime = audioContextRef.current?.currentTime || 0;
      const expectedEndTime = chunkEndTime;
      const actualGap = endedTime - expectedEndTime;
      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:87',message:'TTS_AUDIO: Chunk ended',data:{expectedEndTime,endedTime,actualGapMs:actualGap*1000,queueLength:audioQueueRef.current.length,willPlayNext:audioQueueRef.current.length>0},timestamp:Date.now(),sessionId:'tts-audio-debug',runId:'audio-break',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      playNextChunk();
    };

    source.start(startTime);
  };

  const sendText = async (text: string, tryTrigger: boolean = true) => {
    if (!enabled || !text.trim()) {
      return;
    }

    const ttsRequestStart = performance.now();
    // #region agent log
    fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:117',message:'TTS_AUDIO: Request started',data:{textLength:text.length,textPreview:text.substring(0,100),textEnd:text.substring(text.length-50),fullTextLength:text.length,queueLength:audioQueueRef.current.length,isPlaying:isPlayingRef.current,hasOngoingRequest:!!currentRequestRef.current},timestamp:Date.now(),sessionId:'tts-audio-debug',runId:'audio-break',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    // Only cancel ongoing request if no audio is queued or playing
    // This prevents breaking audio that's already in progress
    if (currentRequestRef.current && audioQueueRef.current.length === 0 && !isPlayingRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:100',message:'TTS_AUDIO: Cancelling previous request (safe - no audio queued)',data:{queueLength:audioQueueRef.current.length,isPlaying:isPlayingRef.current},timestamp:Date.now(),sessionId:'tts-audio-debug',runId:'audio-break-fix',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      currentRequestRef.current.abort();
    } else if (currentRequestRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:105',message:'TTS_AUDIO: NOT cancelling - audio queued or playing',data:{queueLength:audioQueueRef.current.length,isPlaying:isPlayingRef.current},timestamp:Date.now(),sessionId:'tts-audio-debug',runId:'audio-break-fix',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      // Don't cancel - let the current request finish and queue this one after
      // The new request will be queued after current one completes
    }

    const controller = new AbortController();
    currentRequestRef.current = controller;

    try {
      const fetchStart = performance.now();
      const response = await fetch("/api/ai-instructions/tts-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      const fetchEnd = performance.now();

      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:99',message:'TTS response received (TTFB)',data:{status:response.status,ttfbMs:fetchEnd-fetchStart,timeFromRequestStart:fetchEnd-ttsRequestStart},timestamp:Date.now(),sessionId:'debug-session',runId:'tts-latency',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.details || errorData.error || "TTS request failed";
        // #region agent log
        fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:161',message:'TTS_AUDIO: Response not OK',data:{status:response.status,errorMessage,errorData},timestamp:Date.now(),sessionId:'tts-audio-debug',runId:'audio-break',hypothesisId:'H5'})}).catch(()=>{});
        // #endregion
        throw new Error(errorMessage);
      }

      // Stream the audio response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const chunks: Uint8Array[] = [];
      const streamStart = performance.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
        }
      }
      const streamEnd = performance.now();

      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:120',message:'Audio stream complete',data:{chunkCount:chunks.length,totalBytes:chunks.reduce((acc,chunk)=>acc+chunk.length,0),streamDurationMs:streamEnd-streamStart,timeFromRequestStart:streamEnd-ttsRequestStart},timestamp:Date.now(),sessionId:'debug-session',runId:'tts-latency',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      // Combine chunks into a single buffer
      const decodeStart = performance.now();
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combinedBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combinedBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      // Queue the audio for playback
      await queueAudioChunk(combinedBuffer.buffer);
      const decodeEnd = performance.now();

      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:135',message:'Audio decoded and queued',data:{audioSizeBytes:totalLength,decodeLatencyMs:decodeEnd-decodeStart,timeFromRequestStart:decodeEnd-ttsRequestStart},timestamp:Date.now(),sessionId:'debug-session',runId:'tts-latency',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // #region agent log
        fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:167',message:'TTS_AUDIO: Request aborted',data:{queueLength:audioQueueRef.current.length,isPlaying:isPlayingRef.current,textPreview:text.substring(0,50)},timestamp:Date.now(),sessionId:'tts-audio-debug',runId:'audio-break',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        // Request was cancelled, ignore
        return;
      }
      console.error("TTS error:", error);
      setError(error instanceof Error ? error.message : "TTS failed");
      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useStreamingTTS.ts:175',message:'TTS_AUDIO: TTS error',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'tts-audio-debug',runId:'audio-break',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
    } finally {
      currentRequestRef.current = null;
    }
  };

  const endStream = () => {
    // Cancel any ongoing request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
      currentRequestRef.current = null;
    }
  };

  const stopPlayback = () => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = new AudioContext();
      nextStartTimeRef.current = audioContextRef.current.currentTime;
    }
  };

  return {
    isConnected,
    isSpeaking,
    error,
    sendText,
    endStream,
    stopPlayback,
  };
}


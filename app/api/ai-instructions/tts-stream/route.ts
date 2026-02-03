import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import WebSocket from "ws";

export const runtime = "nodejs";

// Note: Next.js 15 App Router doesn't natively support WebSocket upgrades
// This implementation uses HTTP streaming as a bridge
// For true WebSocket support, you would need a custom server setup

export async function POST(req: NextRequest) {
  const serverStart = performance.now();
  // #region agent log
  await fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'tts-stream/route.ts:11',message:'TTS server request received',data:{serverStart},timestamp:Date.now(),sessionId:'debug-session',runId:'tts-latency',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  try {
    // Authenticate user
    const authStart = performance.now();
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("business_info")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (!userData || userData.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const authEnd = performance.now();

    const parseStart = performance.now();
    const { text, voice_id } = await req.json();
    const parseEnd = performance.now();

    // #region agent log
    await fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'tts-stream/route.ts:35',message:'TTS_SERVER: Request parsed',data:{textLength:text?.length || 0,textPreview:text?.substring(0,100) || '',textEnd:text?.substring(Math.max(0,(text?.length || 0)-50)) || '',fullText:text,authLatencyMs:authEnd-authStart,parseLatencyMs:parseEnd-parseStart},timestamp:Date.now(),sessionId:'tts-complete',runId:'tts-after-complete',hypothesisId:'TTS_SERVER'})}).catch(()=>{});
    // #endregion

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: "ElevenLabs API key not configured" },
        { status: 500 }
      );
    }

    const voiceId = voice_id || "EXAVITQu4vr4xnSDxMaL"; // Default voice (Bella)

    // Use ElevenLabs HTTP API for TTS (non-streaming endpoint for complete text)
    // Using non-streaming endpoint since we have complete text - more reliable
    const elevenLabsStart = performance.now();
    // #region agent log
    await fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'tts-stream/route.ts:52',message:'TTS_SERVER: Calling ElevenLabs API (non-streaming)',data:{textLength:text.length,voiceId,usingStreamingEndpoint:false,timeFromServerStart:elevenLabsStart-serverStart},timestamp:Date.now(),sessionId:'tts-complete',runId:'tts-after-complete',hypothesisId:'TTS_SERVER'})}).catch(()=>{});
    // #endregion

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    );
    const elevenLabsEnd = performance.now();

    // #region agent log
    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');
    await fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'tts-stream/route.ts:75',message:'TTS_SERVER: ElevenLabs response received',data:{status:response.status,contentLength,contentType,hasBody:!!response.body,ttfbMs:elevenLabsEnd-elevenLabsStart,timeFromServerStart:elevenLabsEnd-serverStart,textLength:text.length},timestamp:Date.now(),sessionId:'tts-complete',runId:'tts-after-complete',hypothesisId:'TTS_SERVER'})}).catch(()=>{});
    // #endregion

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Extract error message - handle nested structure from ElevenLabs
      let errorMessage = "Unknown error";
      if (errorData.detail) {
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (errorData.detail.message) {
          errorMessage = errorData.detail.message;
        } else if (errorData.detail.status === 'quota_exceeded') {
          errorMessage = errorData.detail.message || "API quota exceeded";
        }
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
      
      // #region agent log
      await fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'tts-stream/route.ts:98',message:'TTS_SERVER: ElevenLabs API error',data:{status:response.status,errorMessage,errorData,hasApiKey:!!ELEVENLABS_API_KEY,apiKeyLength:ELEVENLABS_API_KEY?.length,isQuotaError:errorMessage.includes('quota')},timestamp:Date.now(),sessionId:'tts-complete',runId:'tts-after-complete',hypothesisId:'TTS_SERVER'})}).catch(()=>{});
      // #endregion
      
      // Provide user-friendly error messages
      let userMessage = errorMessage;
      if (response.status === 401) {
        if (errorMessage.includes('quota')) {
          userMessage = `ElevenLabs API quota exceeded: ${errorMessage}`;
        } else {
          userMessage = "Authentication failed - check ELEVENLABS_API_KEY environment variable";
        }
      }
      
      return NextResponse.json(
        {
          error: "ElevenLabs TTS failed",
          details: userMessage,
        },
        { status: response.status }
      );
    }

    // Get the complete audio response (non-streaming endpoint returns complete audio)
    const streamStart = performance.now();
    const audioArrayBuffer = await response.arrayBuffer();
    const streamEnd = performance.now();
    const totalBytes = audioArrayBuffer.byteLength;
    
    // #region agent log
    await fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'tts-stream/route.ts:110',message:'TTS_SERVER: Complete audio received from ElevenLabs',data:{totalBytes,expectedBytesForText:Math.ceil(text.length*15),downloadDurationMs:streamEnd-streamStart,timeFromServerStart:streamEnd-serverStart,textLength:text.length,isComplete:totalBytes>=Math.ceil(text.length*15)*0.9},timestamp:Date.now(),sessionId:'tts-complete',runId:'tts-after-complete',hypothesisId:'TTS_SERVER'})}).catch(()=>{});
    // #endregion

    // Stream the complete audio back to the client
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(audioArrayBuffer));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("TTS route error:", error);
    // #region agent log
    await fetch('http://127.0.0.1:7247/ingest/505504e9-b8cd-4e38-a622-9e897c164e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'tts-stream/route.ts:130',message:'TTS server error',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'tts-latency',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return NextResponse.json(
      {
        error: "Failed to process TTS request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


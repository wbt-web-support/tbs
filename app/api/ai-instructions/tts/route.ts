import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
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

    const { text } = await req.json();

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

    const voiceId = "EXAVITQu4vr4xnSDxMaL"; // Default voice (Bella)

    // Use ElevenLabs HTTP API for TTS (non-streaming endpoint for complete text)
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

    // Get the complete audio response
    const audioArrayBuffer = await response.arrayBuffer();

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
    return NextResponse.json(
      {
        error: "Failed to process TTS request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

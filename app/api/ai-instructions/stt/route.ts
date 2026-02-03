import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super_admin
    const { data: userData } = await supabase
      .from("business_info")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (!userData || userData.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    // ElevenLabs STT API expects field name "file"
    const audioFile = formData.get("file") as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Validate audio file type
    const allowedTypes = [
      "audio/wav",
      "audio/mpeg",
      "audio/webm",
      "audio/mp4",
      "audio/ogg",
      "audio/x-m4a",
    ];

    if (!allowedTypes.includes(audioFile.type)) {
      return NextResponse.json(
        { error: "Invalid audio file type. Allowed: WAV, MPEG, WebM, MP4, OGG, M4A" },
        { status: 400 }
      );
    }

    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: "ElevenLabs API key not configured" },
        { status: 500 }
      );
    }

    // Convert File to FormData for ElevenLabs API
    const elevenLabsFormData = new FormData();
    // ElevenLabs STT API expects field name "file" not "audio"
    elevenLabsFormData.append("file", audioFile);
    // ElevenLabs STT API requires model_id parameter - using scribe_v1 (stable model)
    elevenLabsFormData.append("model_id", "scribe_v1");
    // Force English language to prevent auto-detection issues
    elevenLabsFormData.append("language_code", "en");

    // Call ElevenLabs STT API
    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: elevenLabsFormData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Extract error message - handle array of validation errors
      let errorMessage = "Unknown error";
      if (errorData.detail) {
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
          // Handle validation error array format
          const firstError = errorData.detail[0];
          errorMessage = firstError.msg || firstError.message || JSON.stringify(firstError);
        } else if (errorData.detail.message) {
          errorMessage = errorData.detail.message;
        }
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
      
      // Provide user-friendly error messages
      let userMessage = errorMessage;
      if (response.status === 401) {
        userMessage = "Authentication failed - check ELEVENLABS_API_KEY environment variable";
      } else if (response.status === 422) {
        userMessage = `Invalid request: ${errorMessage}`;
      } else if (response.status === 429) {
        userMessage = "API quota exceeded. Please try again later.";
      }
      
      return NextResponse.json(
        {
          error: "ElevenLabs STT failed",
          details: userMessage,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // ElevenLabs STT API returns text in the 'text' field
    const transcribedText = data.text || "";

    if (!transcribedText) {
      return NextResponse.json(
        { error: "No transcription returned from API" },
        { status: 500 }
      );
    }

    return NextResponse.json({ text: transcribedText });
  } catch (error) {
    console.error("STT route error:", error);
    return NextResponse.json(
      {
        error: "Failed to process STT request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

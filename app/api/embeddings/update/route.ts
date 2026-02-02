import { NextResponse } from "next/server";

/** Stub: chatbot_instructions table removed. */
export async function POST(req: Request) {
  try {
    await req.json();
    return NextResponse.json({ success: true, processed: 0, results: [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update embeddings" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    pendingCount: 0,
    message: "chatbot_instructions table has been removed.",
  });
} 
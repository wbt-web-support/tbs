import { NextResponse } from "next/server";

/** Stub: chatbot_instructions table removed. */
export async function POST() {
  return NextResponse.json({
    success: true,
    message: "chatbot_instructions table has been removed.",
    processed: 0,
    results: [],
  });
}

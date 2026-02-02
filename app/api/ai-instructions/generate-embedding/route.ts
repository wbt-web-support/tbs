import { NextResponse } from "next/server";

/** Stub: ai_instructions table has been removed. Products page may still call this. */
export async function POST() {
  return NextResponse.json({ success: true });
}

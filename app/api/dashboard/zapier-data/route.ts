import { NextResponse } from "next/server";

/** Zapier data stub. zapier_webhooks table has been removed. */
export async function GET() {
  return NextResponse.json({ data: [] });
} 
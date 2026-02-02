import { NextRequest, NextResponse } from "next/server";

/** Zapier webhook stub. zapier_mappings and zapier_webhooks tables have been removed. */
export async function POST(req: NextRequest) {
  try {
    await req.json();
    return NextResponse.json({ message: "Webhook received" });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
} 
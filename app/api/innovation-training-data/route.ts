import { NextRequest, NextResponse } from "next/server";

/** Stub: innovation_chat_training_data table removed. */
export async function GET(req: NextRequest) {
  const action = new URL(req.url).searchParams.get("action");
  if (action === "stats") {
    return NextResponse.json({
      type: "training_stats",
      totalSessions: 0,
      totalMessages: 0,
      reasonBreakdown: {},
      dateRange: { earliest: null, latest: null },
    });
  }
  return NextResponse.json({
    type: "training_data_export",
    data: [],
    count: 0,
    offset: 0,
    limit: 100,
  });
}

export async function POST() {
  return NextResponse.json({ error: "Innovation training feature removed" }, { status: 410 });
}

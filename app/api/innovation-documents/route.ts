import { NextRequest, NextResponse } from "next/server";

/** Stub: innovation_documents table removed. RealtimeChatGemini expects { documents: [] }. */
export async function GET(req: NextRequest) {
  try {
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ documents: [] });
  } catch {
    return NextResponse.json({ documents: [] });
  }
}

export async function POST() {
  return NextResponse.json({ error: "Innovation documents feature removed" }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Innovation documents feature removed" }, { status: 410 });
}

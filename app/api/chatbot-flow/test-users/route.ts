import { NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/chatbot-flow/superadmin";

/**
 * GET /api/chatbot-flow/test-users
 * Returns users the superadmin can "test as" when testing a chatbot (user_id, email, full_name, team_id, role).
 */
export async function GET() {
  try {
    const supabase = await verifySuperAdmin();
    const { data, error } = await supabase
      .from("business_info")
      .select("user_id, email, full_name, team_id, role")
      .not("user_id", "is", null)
      .order("full_name", { ascending: true });

    if (error) {
      console.error("[chatbot-flow/test-users] GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = (data ?? []).map((row) => ({
      id: row.user_id,
      email: row.email ?? "",
      full_name: row.full_name ?? "",
      team_id: row.team_id ?? null,
      role: row.role ?? "user",
    }));

    return NextResponse.json({ users });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message.includes("authenticated") ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

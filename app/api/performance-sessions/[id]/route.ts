import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    const { error } = await supabase
      .from("performance_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting performance session:", error);
      return new NextResponse("Internal Server Error", { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/performance-sessions/[id]:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

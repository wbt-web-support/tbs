import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdminClient } from "@/lib/chatbot-flow/superadmin";

// Use ai-instructions bucket (already exists) with a dedicated path to avoid requiring a new bucket
const BUCKET = "ai-instructions";
const PATH_PREFIX = "business-plan";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const planId = formData.get("planId") as string | null;

    if (!file || !planId) {
      return NextResponse.json(
        { error: "Missing file or planId" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PDF, DOC, DOCX, TXT" },
        { status: 400 }
      );
    }

    const { data: businessInfo, error: bizError } = await supabase
      .from("business_info")
      .select("team_id")
      .eq("user_id", user.id)
      .single();

    if (bizError || !businessInfo?.team_id) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const { data: plan, error: planError } = await supabase
      .from("battle_plan")
      .select("id, user_id")
      .eq("id", planId)
      .single();

    if (planError || !plan || plan.user_id !== businessInfo.team_id) {
      return NextResponse.json({ error: "Plan not found or access denied" }, { status: 404 });
    }

    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 80);
    const timestamp = Date.now();
    const storagePath = `${PATH_PREFIX}/${businessInfo.team_id}/${planId}/${timestamp}-${sanitized}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use service-role client for storage so upload bypasses bucket RLS (auth already validated above)
    const adminClient = getAdminClient();
    const { error: uploadError } = await adminClient.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Business plan upload error:", uploadError);
      return NextResponse.json(
        { error: "Upload failed", details: uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = adminClient.storage.from(BUCKET).getPublicUrl(storagePath);

    await supabase
      .from("battle_plan")
      .update({ businessplanlink: urlData.publicUrl })
      .eq("id", planId);

    return NextResponse.json({
      success: true,
      documentUrl: urlData.publicUrl,
      storagePath,
      fileName: file.name,
    });
  } catch (error) {
    console.error("Error in business-plan upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

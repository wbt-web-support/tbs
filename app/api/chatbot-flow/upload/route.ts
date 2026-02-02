import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/** Upload a file for chatbot base prompts. Stores in ai-instructions bucket; returns documentUrl and documentName. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("business_info")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (!userData || userData.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PDF, DOCX, TXT, CSV, XLSX" },
        { status: 400 }
      );
    }

    const category = (formData.get("category") as string) || "other";
    const title = (formData.get("title") as string) || "";
    const instructionType = (formData.get("instruction_type") as string) || "document";
    const validCategories = ["company_info", "product_info", "service_info", "other"];
    const fileCategory = validCategories.includes(category) ? category : "other";

    const bucketName = "ai-instructions";
    const fileExt = file.name.split(".").pop();
    const sanitizeForFilename = (text: string): string =>
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s\-_]/g, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .substring(0, 50) || "document";

    const sanitizedTitle = sanitizeForFilename(title || file.name.replace(/\.[^/.]+$/, ""));
    const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const shortId = Math.random().toString(36).substring(2, 8);
    const fileName = `${fileCategory}_${sanitizedTitle}_${instructionType}_${timestamp}_${shortId}.${fileExt}`;
    const filePath = `${fileCategory}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file", details: uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      documentUrl: urlData.publicUrl,
      documentName: fileName,
      originalFileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      category: fileCategory,
      storagePath: filePath,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      {
        error: "Failed to upload file",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

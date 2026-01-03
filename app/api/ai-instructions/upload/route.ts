import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super_admin
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

    // Validate file type
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

    // Get metadata from form data
    const category = formData.get("category") as string || "other";
    const title = formData.get("title") as string || "";
    const instructionType = formData.get("instruction_type") as string || "document";
    
    // Validate category
    const validCategories = ["company_info", "product_info", "service_info", "other"];
    const fileCategory = validCategories.includes(category) ? category : "other";

    const bucketName = "ai-instructions";
    
    // Create descriptive filename for AI understanding
    // Format: {category}_{sanitized-title}_{type}_{timestamp}.{ext}
    const fileExt = file.name.split(".").pop();
    
    // Sanitize title for filename (remove special chars, limit length)
    const sanitizeForFilename = (text: string): string => {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9\s\-_]/g, '') // Remove special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_+/g, '_') // Replace multiple underscores with single
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
        .substring(0, 50) // Limit to 50 characters
        || 'document'; // Fallback if empty
    };
    
    const sanitizedTitle = sanitizeForFilename(title || file.name.replace(/\.[^/.]+$/, ""));
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD format
    const shortId = Math.random().toString(36).substring(2, 8); // Short unique ID
    
    // Create descriptive filename: category_title_type_date_id.ext
    const fileName = `${fileCategory}_${sanitizedTitle}_${instructionType}_${timestamp}_${shortId}.${fileExt}`;
    
    // Organize files by category: {category}/{filename}
    const filePath = `${fileCategory}/${fileName}`;

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
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

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      documentUrl: urlData.publicUrl,
      documentName: fileName, // Return the descriptive filename
      originalFileName: file.name, // Keep original for reference
      fileSize: file.size,
      fileType: file.type,
      category: fileCategory,
      storagePath: filePath, // Full path in storage
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


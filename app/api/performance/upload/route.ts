import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const month = formData.get('month') as string;
    const year = formData.get('year') as string;
    const period_type = (formData.get('period_type') as string) || 'monthly';


    if (!file || !month || !year) {
      return NextResponse.json(
        { error: 'Missing required fields: file, month, year' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, Excel, and CSV files are allowed.' },
        { status: 400 }
      );
    }

    // Get user's team_id
    const { data: businessInfo, error: businessError } = await supabase
      .from('business_info')
      .select('team_id, full_name')
      .eq('user_id', user.id)
      .single();

    if (businessError || !businessInfo) {
      return NextResponse.json(
        { error: 'User business info not found' },
        { status: 404 }
      );
    }

    // Create unique file name
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${user.id}/${timestamp}-${sanitizedFileName}`;

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // --- EXTRACTION LOGIC START ---
    let extractedText = "";
    try {
      if (file.type === "application/pdf") {
        const data = await pdfParse(buffer);
        extractedText = data.text;
      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel" ||
        file.type === "text/csv" ||
        file.name.endsWith(".csv") ||
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls")
      ) {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        let sheetContent = "";
        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          if (jsonData.length > 0) {
            sheetContent += `\n=== Sheet: ${sheetName} ===\n\n`;
            const rows = jsonData as any[][];
            if (rows.length > 0 && rows[0].length > 0) {
              sheetContent += "Headers: " + rows[0].map(cell => String(cell || "")).join(" | ") + "\n\n";
            }
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              if (row && row.length > 0 && row.some(cell => cell && String(cell).trim().length > 0)) {
                sheetContent += `Row ${i}: ` + row.map(cell => String(cell || "")).join(" | ") + "\n";
              }
            }
          }
        });
        extractedText = sheetContent.trim();
      }
    } catch (extractError) {
      console.error("Extraction error (non-fatal):", extractError);
      // We continue upload even if extraction fails
    }

    const MAX_LENGTH = 100000;
    if (extractedText.length > MAX_LENGTH) {
      extractedText = extractedText.substring(0, MAX_LENGTH) + "\n... [Content truncated]";
    }
    // --- EXTRACTION LOGIC END ---

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('finance-files')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('finance-files')
      .getPublicUrl(storagePath);

    // Save metadata to database
    const { data: fileData, error: dbError } = await supabase
      .from('finance_files')
      .insert({
        user_id: user.id,
        team_id: businessInfo.team_id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_url: urlData.publicUrl,
        storage_path: storagePath,
        month: month,
        year: year,
        period_type: period_type,
        uploaded_by: businessInfo.full_name || user.email || 'Unknown',
        extracted_text: extractedText

      })
      .select()
      .single();

    if (dbError) {
      // If database insert fails, delete the uploaded file
      await supabase.storage.from('finance-files').remove([storagePath]);
      
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to save file metadata', details: dbError.message },
        { status: 500 }
      );
    }

    // --- AUTOMATIC ANALYSIS TRIGGER ---
    // Instead of waiting for Gemini, we create a pending analysis record 
    // and return success to the user immediately.
    await supabase
      .from("finance_analysis")
      .insert({
        file_id: fileData.id,
        user_id: user.id,
        team_id: businessInfo.team_id,
        analysis_result: null,
        summary: "Analysis in progress...",
        status: 'pending',
        period_type: period_type
      });

    // --- END AUTOMATIC ANALYSIS TRIGGER ---

    return NextResponse.json({
      success: true,
      file: fileData
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

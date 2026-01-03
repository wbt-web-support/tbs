/**
 * Sheet Extraction API
 * 
 * Supports:
 * - CSV files (native parsing, no dependencies)
 * - XLSX files (requires 'xlsx' package: npm install xlsx)
 * - XLS files (requires 'xlsx' package: npm install xlsx)
 * 
 * For Excel support, install: npm install xlsx @types/xlsx
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let file: File | null = null;
    let url: string | null = null;

    // Check if the request is multipart/form-data
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      file = formData.get("file") as File;
    } else {
      // Handle JSON request body
      const body = await request.json();
      url = body.url;
    }

    if (!file && !url) {
      return NextResponse.json(
        { error: "Either file or URL is required" },
        { status: 400 }
      );
    }

    let content = "";
    let fileName = "";

    if (file) {
      fileName = file.name;
      const fileType = file.type;
      const fileExtension = fileName.split(".").pop()?.toLowerCase();

      // Handle CSV files
      if (fileType === "text/csv" || fileExtension === "csv") {
        const text = await file.text();
        content = await parseCSV(text);
      }
      // Handle Excel files (XLSX)
      else if (
        fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        fileExtension === "xlsx"
      ) {
        content = await parseExcelXLSX(file);
      }
      // Handle older Excel format (XLS)
      else if (
        fileType === "application/vnd.ms-excel" ||
        fileExtension === "xls"
      ) {
        content = await parseExcelXLS(file);
      } else {
        return NextResponse.json(
          { error: "Unsupported sheet format. Supported: CSV, XLSX, XLS" },
          { status: 400 }
        );
      }
    } else if (url) {
      // Handle URL-based extraction (e.g., Google Sheets)
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }

        const text = await response.text();
        
        // Try to detect if it's CSV
        if (url.includes('.csv') || text.includes(',')) {
          content = await parseCSV(text);
        } else {
          // For other formats, return as-is or try to parse
          content = text;
        }
        
        fileName = url.split("/").pop() || "sheet";
      } catch (error) {
        console.error("Error fetching sheet from URL:", error);
        return NextResponse.json(
          { error: "Failed to fetch sheet from URL" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      content,
      fileName,
      extractionDate: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error extracting sheet content:", error);
    return NextResponse.json(
      {
        error: "Failed to extract sheet content",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Parse CSV content into readable text format
 * Handles quoted values, escaped quotes, and newlines within cells
 */
async function parseCSV(csvText: string): Promise<string> {
  try {
    // Simple CSV parser that handles quoted values
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote
            current += '"';
            i++; // Skip next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // End of field
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      // Add last field
      result.push(current.trim());
      return result;
    };

    // Split by newlines, but respect quoted newlines
    const lines: string[] = [];
    let currentLine = "";
    let inQuotes = false;
    
    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentLine += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
          currentLine += char;
        }
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (currentLine.trim().length > 0) {
          lines.push(currentLine);
        }
        currentLine = "";
        // Skip \r\n combination
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        currentLine += char;
      }
    }
    
    // Add last line
    if (currentLine.trim().length > 0) {
      lines.push(currentLine);
    }

    if (lines.length === 0) return "";

    // Parse all lines
    const rows: string[][] = lines.map(parseCSVLine);

    if (rows.length === 0) return "";

    // Convert to readable text format
    let output = "";
    
    // Add header row
    if (rows.length > 0 && rows[0].length > 0) {
      output += "Headers: " + rows[0].join(" | ") + "\n\n";
    }

    // Add data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && row.length > 0 && row.some(cell => cell && cell.trim().length > 0)) {
        output += `Row ${i}: ` + row.join(" | ") + "\n";
      }
    }

    return output.trim() || "No data found in CSV file";
  } catch (error) {
    console.error("Error parsing CSV:", error);
    // Fallback: return raw text
    return csvText;
  }
}

/**
 * Parse Excel XLSX files
 * Note: Requires 'xlsx' package. Install with: npm install xlsx
 */
async function parseExcelXLSX(file: File): Promise<string> {
  try {
    // Dynamic import to handle case where package might not be installed
    const XLSX = await import('xlsx').catch(() => null);
    
    if (!XLSX) {
      throw new Error(
        "XLSX package not installed. Please install it with: npm install xlsx"
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    let output = "";
    
    // Process each sheet
    workbook.SheetNames.forEach((sheetName, index) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      if (jsonData.length > 0) {
        output += `\n=== Sheet: ${sheetName} ===\n\n`;
        
        // Convert to readable format
        const rows = jsonData as any[][];
        
        // Add header row if exists
        if (rows.length > 0 && rows[0].length > 0) {
          output += "Headers: " + rows[0].map(cell => String(cell || '')).join(" | ") + "\n\n";
        }
        
        // Add data rows
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row && row.length > 0 && row.some(cell => cell && String(cell).trim().length > 0)) {
            output += `Row ${i}: ` + row.map(cell => String(cell || '')).join(" | ") + "\n";
          }
        }
        
        output += "\n";
      }
    });

    return output.trim() || "No data found in spreadsheet";
  } catch (error) {
    console.error("Error parsing XLSX:", error);
    throw error;
  }
}

/**
 * Parse Excel XLS files (older format)
 * Note: Requires 'xlsx' package which also supports XLS format
 */
async function parseExcelXLS(file: File): Promise<string> {
  try {
    // XLSX package also handles XLS format
    return await parseExcelXLSX(file);
  } catch (error) {
    console.error("Error parsing XLS:", error);
    throw new Error("Failed to parse XLS file. Please ensure xlsx package is installed.");
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Helper to extract text from PDF
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
    const data = await pdfParse(buffer);
    return data.text;
}

// Helper to extract text from Sheet (Excel/CSV)
async function extractTextFromSheet(buffer: Buffer): Promise<string> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let content = "";
    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        content += `Sheet: ${sheetName}\n`;
        jsonData.forEach((row: any) => {
            content += row.join(' | ') + '\n';
        });
    });
    return content;
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const clientId = formData.get('clientId') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const fileName = file.name.toLowerCase();
        const buffer = Buffer.from(await file.arrayBuffer());
        let extractedText = "";

        if (fileName.endsWith('.pdf')) {
            extractedText = await extractTextFromPDF(buffer);
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
            extractedText = await extractTextFromSheet(buffer);
        } else {
            return NextResponse.json({ error: 'Unsupported file format' }, { status: 400 });
        }

        if (!extractedText || extractedText.trim().length === 0) {
            return NextResponse.json({ error: 'Could not extract text from file' }, { status: 400 });
        }

        // Use Gemini to extract structured product data
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        const prompt = `
            Extract product information from the following text and return it as a JSON object.
            
            Valid categories are precisely: 'boiler', 'ac', 'ashp', 'battery_storage', 'solar'.
            
            The JSON structure should be:
            {
                "title": "Main product name",
                "category": "one of the categories above",
                "subtitle": "Short sub-heading or model variant",
                "power_rating": "Power details like 24kW, 5kW, etc.",
                "base_price": numeric price value or null,
                "description": "Short summary of the product",
                "product_specs": {
                    "key": "value"
                }
            }

            Text to extract from:
            ${extractedText.substring(0, 15000)} // Limit to 15k chars for prompt safety
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Clean up JSON response (Gemini sometimes adds markdown blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("Could not parse AI response as JSON");
        }
        
        const productData = JSON.parse(jsonMatch[0]);

        // Validation: Required fields
        if (!productData.title || !productData.category) {
            return NextResponse.json({ error: 'AI failed to extract required fields (title, category)' }, { status: 422 });
        }

        // Upload file to Supabase Storage
        const fileExt = fileName.split('.').pop();
        const storagePath = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
            .from('product-docs')
            .upload(storagePath, buffer, {
                contentType: file.type,
                upsert: true
            });

        if (uploadError) throw new Error(`Storage Upload Error: ${uploadError.message}`);

        const { data: { publicUrl } } = supabase.storage
            .from('product-docs')
            .getPublicUrl(storagePath);

        // Prepare product data - only include fields that exist in schema
        // Convert base_price to number if it's a string
        const basePrice = productData.base_price ? 
            (typeof productData.base_price === 'string' ? parseFloat(productData.base_price) : productData.base_price) : 
            null;

        // Only return extracted data; do NOT save to database
        return NextResponse.json({ 
            success: true, 
            product: {
                title: productData.title,
                category: productData.category,
                subtitle: productData.subtitle || null,
                power_rating: productData.power_rating || null,
                base_price: basePrice,
                description: productData.description || null,
                product_specs: productData.product_specs || {},
                doc_link: publicUrl
            },
            message: "Product extracted successfully (not saved). Review and click Save to store it."
        });

    } catch (error: any) {
        console.error('Extraction Error:', error);
        return NextResponse.json({ 
            error: 'Failed to extract product data', 
            details: error.message 
        }, { status: 500 });
    }
}

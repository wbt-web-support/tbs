import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import puppeteer from 'puppeteer';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt();

export async function POST(req: NextRequest) {
  let browser: any = null;
  
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sopId } = await req.json();

    if (!sopId) {
      return NextResponse.json({ error: "SOP ID is required" }, { status: 400 });
    }

    // Get the SOP
    const { data: sop, error: sopError } = await supabase
      .from('sop_data')
      .select('title, content, version, created_at, updated_at, metadata')
      .eq('id', sopId)
      .eq('user_id', user.id)
      .single();

    if (sopError || !sop) {
      return NextResponse.json({ error: "SOP not found" }, { status: 404 });
    }

    // Convert markdown content to HTML
    const renderedHtmlContent = md.render(sop.content);

    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${sop.title}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #1a1a1a;
              background: white;
              font-size: 11pt;
              padding: 0;
              margin: 0;
            }

            .container {
              max-width: 100%;
              margin: 0 auto;
              padding: 40px 50px 60px 50px;
              min-height: 100vh;
              position: relative;
            }

            /* Header Section */
            .header {
              text-align: left;
              margin-bottom: 20px;
              padding-bottom: 30px;
              border-bottom: 1px solid #e5e5e5;
            }

            .header h1 {
              font-size: 28pt;
              font-weight: 300;
              color: #1a1a1a;
              margin-bottom: 12px;
              letter-spacing: -0.02em;
              line-height: 1.2;
            }

            .header .subtitle {
              font-size: 11pt;
              color: #6b7280;
              font-weight: 400;
              text-transform: uppercase;
              letter-spacing: 0.15em;
            }

            /* Metadata Section */
            .metadata {
              background: #fafafa;
              border: 1px solid #e5e5e5;
              border-radius: 4px;
              padding: 30px;
              margin-bottom: 20px;
            }

            .metadata-title {
              font-size: 13pt;
              font-weight: 600;
              color: #1a1a1a;
              margin-bottom: 20px;
              display: flex;
              align-items: center;
              text-transform: uppercase;
              letter-spacing: 0.1em;
            }

            .metadata-title::before {
              content: "•";
              margin-right: 10px;
              font-size: 14pt;
              color: #6b7280;
            }

            .metadata-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 16px;
            }

            .metadata-item {
              display: flex;
              align-items: flex-start;
              font-size: 10pt;
              line-height: 1.5;
            }

            .metadata-label {
              font-weight: 600;
              color: #1a1a1a;
              min-width: 100px;
              margin-right: 15px;
            }

            .metadata-value {
              color: #4b5563;
              flex: 1;
            }

            /* Content Section */
            .content {
              line-height: 1.8;
              color: #1a1a1a;
              padding-bottom: 70px;
            }

            /* Typography */
            .content h1 {
              font-size: 22pt;
              font-weight: 400;
              color: #1a1a1a;
              margin: 40px 0 20px 0;
              padding-bottom: 12px;
              border-bottom: 1px solid #e5e5e5;
              page-break-after: avoid;
              letter-spacing: -0.01em;
            }

            .content h2 {
              font-size: 18pt;
              font-weight: 500;
              color: #1a1a1a;
              margin: 35px 0 18px 0;
              page-break-after: avoid;
              letter-spacing: -0.01em;
            }

            .content h3 {
              font-size: 15pt;
              font-weight: 500;
              color: #1a1a1a;
              margin: 30px 0 15px 0;
              page-break-after: avoid;
            }

            .content h4 {
              font-size: 13pt;
              font-weight: 500;
              color: #1a1a1a;
              margin: 25px 0 12px 0;
              page-break-after: avoid;
            }

            .content h5 {
              font-size: 12pt;
              font-weight: 500;
              color: #1a1a1a;
              margin: 20px 0 10px 0;
              page-break-after: avoid;
            }

            .content h6 {
              font-size: 11pt;
              font-weight: 500;
              color: #1a1a1a;
              margin: 18px 0 8px 0;
              page-break-after: avoid;
            }

            .content p {
              margin-bottom: 16px;
              text-align: justify;
              orphans: 3;
              widows: 3;
              color: #374151;
            }

            /* Lists */
            .content ul, .content ol {
              margin: 20px 0;
              padding-left: 30px;
            }

            .content li {
              margin-bottom: 8px;
              line-height: 1.7;
              page-break-inside: avoid;
              color: #374151;
            }

            .content ul li::marker {
              color: #6b7280;
            }

            .content ol li::marker {
              color: #6b7280;
              font-weight: 500;
            }

            /* Text formatting */
            .content strong, .content b {
              font-weight: 600;
              color: #1a1a1a;
            }

            .content em, .content i {
              font-style: italic;
              color: #4b5563;
            }

            /* Blockquotes */
            .content blockquote {
              margin: 25px 0;
              padding: 20px 25px;
              background: #f9f9f9;
              border-left: 3px solid #d1d5db;
              border-radius: 0 4px 4px 0;
              font-style: italic;
              color: #4b5563;
              position: relative;
            }

            .content blockquote::before {
              content: """;
              font-size: 28pt;
              color: #d1d5db;
              position: absolute;
              top: 10px;
              left: 10px;
              font-family: Georgia, serif;
              line-height: 1;
            }

            /* Code */
            .content code {
              background: #f5f5f5;
              color: #e11d48;
              padding: 3px 6px;
              border-radius: 3px;
              font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
              font-size: 9pt;
              border: 1px solid #e5e5e5;
            }

            .content pre {
              background: #f8f8f8;
              border: 1px solid #e5e5e5;
              border-radius: 4px;
              padding: 25px;
              margin: 25px 0;
              overflow-x: auto;
              font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
              font-size: 9pt;
              line-height: 1.6;
            }

            .content pre code {
              background: none;
              border: none;
              padding: 0;
              color: #374151;
            }

            /* Tables */
            .content table {
              width: 100%;
              border-collapse: collapse;
              margin: 30px 0;
              font-size: 10pt;
              border: 1px solid #e5e5e5;
              border-radius: 4px;
              overflow: hidden;
            }

            .content th {
              background: #1a1a1a;
              color: white;
              padding: 15px 18px;
              text-align: left;
              font-weight: 500;
              font-size: 9pt;
              text-transform: uppercase;
              letter-spacing: 0.1em;
            }

            .content td {
              padding: 15px 18px;
              border-bottom: 1px solid #f0f0f0;
              background: white;
              color: #374151;
            }

            .content tr:nth-child(even) td {
              background: #fafafa;
            }

            /* Links */
            .content a {
              color: #1a1a1a;
              text-decoration: underline;
              text-decoration-color: #d1d5db;
              text-underline-offset: 2px;
              font-weight: 400;
              transition: text-decoration-color 0.2s;
            }

            .content a:hover {
              text-decoration-color: #1a1a1a;
            }

            /* Horizontal Rule */
            .content hr {
              margin: 40px 0;
              border: none;
              height: 1px;
              background: #e5e5e5;
            }

            /* Print optimizations */
            @media print {
              .container {
                padding: 20px 30px 40px 30px;
              }
              
              .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
                page-break-after: avoid;
              }
              
              .content img, .content table, .content blockquote, .content pre {
                page-break-inside: avoid;
              }
              
              .content p {
                orphans: 3;
                widows: 3;
              }
            }

            /* Page break utilities */
            .page-break {
              page-break-before: always;
            }

            .avoid-break {
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <h1>${sop.title}</h1>
              <div class="subtitle">Standard Operating Procedure</div>
            </div>
            
            <!-- Metadata Section -->
            <div class="metadata">
              <div class="metadata-grid">
                
                <div class="metadata-item">
                  <span class="metadata-label">Created:</span>
                  <span class="metadata-value">${new Date(sop.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric'})}</span>
                </div>
                <div class="metadata-item">
                  <span class="metadata-label">Last Updated:</span>
                  <span class="metadata-value">${new Date(sop.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric'})}</span>
                </div>
              </div>
            </div>
            
            <!-- Content -->
            <div class="content">
              ${renderedHtmlContent}
            </div>
          </div>
        </body>
      </html>
    `;

    console.log("Starting PDF generation for SOP:", sopId);

    // Launch Puppeteer with better error handling and timeouts
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security'
      ],
      executablePath: '/home/ubuntu/.cache/puppeteer/chrome/linux-136.0.7103.94/chrome-linux64/chrome',
      timeout: 30000 // 30 second timeout for browser launch
    });

    console.log("Browser launched successfully");

    const page = await browser.newPage();
    
    // Set a shorter timeout for page operations
    page.setDefaultTimeout(30000); // 30 seconds instead of default 30 seconds
    
    // Set content with a faster wait strategy
    await page.setContent(htmlTemplate, { 
      waitUntil: 'domcontentloaded', // Changed from 'networkidle0' to 'domcontentloaded'
      timeout: 20000 // 20 second timeout for content loading
    });
    
    console.log("Page content set successfully");
    
    const generationDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric'});
    const pageMarginMm = 20;

    console.log("Generating PDF...");

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: `${pageMarginMm}mm`,
        right: `${pageMarginMm}mm`,
        bottom: `${pageMarginMm + 5}mm`, // Increased bottom margin slightly for more footer space
        left: `${pageMarginMm}mm`
      },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>', // Keeping header empty
      footerTemplate: `
        <div style="font-size: 8pt; color: #9ca3af; text-align: center; width: 100%; box-sizing: border-box; padding: 0 ${pageMarginMm}mm;">
          <div style="margin-bottom: 3px;">By Trade Business School on ${generationDate}</div>
          <div>
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>
        </div>
      `,
      printBackground: true,
      preferCSSPageSize: false,
      timeout: 60000 // 60 second timeout for PDF generation
    });

    console.log("PDF generated successfully");

    await browser.close();
    browser = null; // Set to null after successful close
    
    const filename = `${sop.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_v${sop.version}.pdf`;

    console.log("Returning PDF response");

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error("PDF Generation API Error:", error);
    
    // Ensure browser is closed even on error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error("Error closing browser:", closeError);
      }
    }
    
    return NextResponse.json({ 
      error: error.message || "Failed to generate PDF" 
    }, { status: 500 });
  }
} 
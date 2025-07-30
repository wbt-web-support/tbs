import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  LevelFormat,
  NumberFormat,
  convertInchesToTwip
} from 'docx';
import { JSDOM } from 'jsdom';

async function getUserId(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }
    
    return user.id;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
}

function parseHTMLToDocxElements(html: string) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const elements: any[] = [];

  function processNode(node: Node): any[] {
    const results: any[] = [];

    if (node.nodeType === node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        results.push(new TextRun({ text }));
      }
      return results;
    }

    if (node.nodeType === node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      switch (tagName) {
        case 'h1':
          results.push(new Paragraph({
            text: element.textContent || '',
            heading: HeadingLevel.HEADING_1,
          }));
          break;

        case 'h2':
          results.push(new Paragraph({
            text: element.textContent || '',
            heading: HeadingLevel.HEADING_2,
          }));
          break;

        case 'h3':
          results.push(new Paragraph({
            text: element.textContent || '',
            heading: HeadingLevel.HEADING_3,
          }));
          break;

        case 'h4':
        case 'h5':
        case 'h6':
          results.push(new Paragraph({
            text: element.textContent || '',
            heading: HeadingLevel.HEADING_4,
          }));
          break;

        case 'p':
          const textRuns: TextRun[] = [];
          element.childNodes.forEach(child => {
            if (child.nodeType === child.TEXT_NODE) {
              const text = child.textContent?.trim();
              if (text) {
                textRuns.push(new TextRun({ text }));
              }
            } else if (child.nodeType === child.ELEMENT_NODE) {
              const childElement = child as Element;
              const childTagName = childElement.tagName.toLowerCase();
              const text = childElement.textContent?.trim();
              
              if (text) {
                switch (childTagName) {
                  case 'strong':
                  case 'b':
                    textRuns.push(new TextRun({ text, bold: true }));
                    break;
                  case 'em':
                  case 'i':
                    textRuns.push(new TextRun({ text, italics: true }));
                    break;
                  case 'u':
                    textRuns.push(new TextRun({ text, underline: { type: "single" } }));
                    break;
                  case 's':
                  case 'strike':
                    textRuns.push(new TextRun({ text, strike: true }));
                    break;
                  case 'code':
                    textRuns.push(new TextRun({ text, font: 'Courier New' }));
                    break;
                  default:
                    textRuns.push(new TextRun({ text }));
                }
              }
            }
          });
          
          if (textRuns.length > 0) {
            results.push(new Paragraph({ children: textRuns }));
          }
          break;

        case 'ul':
          element.querySelectorAll('li').forEach((li, index) => {
            results.push(new Paragraph({
              text: li.textContent || '',
              bullet: { level: 0 },
            }));
          });
          break;

        case 'ol':
          element.querySelectorAll('li').forEach((li, index) => {
            results.push(new Paragraph({
              text: li.textContent || '',
              numbering: {
                reference: 'default-numbering',
                level: 0,
              },
            }));
          });
          break;

        case 'blockquote':
          results.push(new Paragraph({
            text: element.textContent || '',
            spacing: { before: 200, after: 200 },
            border: {
              left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
            },
            indent: { left: 720 }, // 0.5 inch
          }));
          break;

        case 'table':
          const tableRows: TableRow[] = [];
          element.querySelectorAll('tr').forEach(tr => {
            const cells: TableCell[] = [];
            tr.querySelectorAll('td, th').forEach(cell => {
              const isHeader = cell.tagName.toLowerCase() === 'th';
              cells.push(new TableCell({
                children: [new Paragraph({ text: cell.textContent || '' })],
                shading: isHeader ? { fill: 'F2F2F2' } : undefined,
              }));
            });
            tableRows.push(new TableRow({ children: cells }));
          });
          
          if (tableRows.length > 0) {
            results.push(new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            }));
          }
          break;

        case 'hr':
          results.push(new Paragraph({
            children: [],
            spacing: { before: 200, after: 200 },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
          }));
          break;

        default:
          // Process child nodes recursively
          element.childNodes.forEach(child => {
            results.push(...processNode(child));
          });
      }
    }

    return results;
  }

  // Process all child nodes of the body
  doc.body.childNodes.forEach(child => {
    elements.push(...processNode(child));
  });

  return elements;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, filename = 'document' } = await req.json();

    if (!content) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 });
    }

    // Parse HTML content to DOCX elements
    const docxElements = parseHTMLToDocxElements(content);

    // Create the document
    const doc = new Document({
      sections: [{
        properties: {},
        children: docxElements,
      }],
      numbering: {
        config: [{
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
                },
              },
            },
          ],
        }],
      },
    });

    // Generate the DOCX file
    const buffer = await Packer.toBuffer(doc);

    // Create filename
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9]/g, '_');
    const finalFilename = `${sanitizedFilename}_${new Date().toISOString().split('T')[0]}.docx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${finalFilename}"`,
      },
      status: 200,
    });

  } catch (error) {
    console.error('DOCX Export Error:', error);
    return NextResponse.json({ 
      error: 'Failed to export DOCX',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
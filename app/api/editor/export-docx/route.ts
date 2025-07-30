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
  convertInchesToTwip,
  Tab,
  TabStopType,
  TabStopPosition,
  PageNumber,
  Header,
  Footer,
  ExternalHyperlink,
  UnderlineType,
  ShadingType
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

function extractDocumentTitle(html: string): string {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  
  // Look for the first h1, h2, or p element with meaningful content
  const selectors = ['h1', 'h2', 'p'];
  
  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    if (element && element.textContent && element.textContent.trim().length > 0) {
      const text = element.textContent.trim();
      // Clean up the text for filename use
      return text
        .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special characters except spaces, hyphens, underscores
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim()
        .substring(0, 50); // Limit to 50 characters
    }
  }
  
  return 'document'; // Fallback
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
        results.push(new TextRun({ 
          text,
          font: 'Calibri',
          size: 24, // 12pt
          color: '2F2F2F'
        }));
      }
      return results;
    }

    if (node.nodeType === node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      switch (tagName) {
        case 'h1':
          results.push(new Paragraph({
            children: [
              new TextRun({
                text: element.textContent || '',
                bold: true,
                size: 36, // 18pt
                color: '1F4E79',
                font: 'Calibri'
              })
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 480, after: 240 }, // 24pt before, 12pt after
            alignment: AlignmentType.LEFT,
          }));
          break;

        case 'h2':
          results.push(new Paragraph({
            children: [
              new TextRun({
                text: element.textContent || '',
                bold: true,
                size: 32, // 16pt
                color: '2E5984',
                font: 'Calibri'
              })
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 360, after: 180 }, // 18pt before, 9pt after
            alignment: AlignmentType.LEFT,
          }));
          break;

        case 'h3':
          results.push(new Paragraph({
            children: [
              new TextRun({
                text: element.textContent || '',
                bold: true,
                size: 28, // 14pt
                color: '3A6EA5',
                font: 'Calibri'
              })
            ],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 300, after: 120 }, // 15pt before, 6pt after
            alignment: AlignmentType.LEFT,
          }));
          break;

        case 'h4':
        case 'h5':
        case 'h6':
          results.push(new Paragraph({
            children: [
              new TextRun({
                text: element.textContent || '',
                bold: true,
                size: 26, // 13pt
                color: '4A7CBE',
                font: 'Calibri'
              })
            ],
            heading: HeadingLevel.HEADING_4,
            spacing: { before: 240, after: 120 }, // 12pt before, 6pt after
            alignment: AlignmentType.LEFT,
          }));
          break;

        case 'p':
          const textRuns: TextRun[] = [];
          element.childNodes.forEach(child => {
            if (child.nodeType === child.TEXT_NODE) {
              const text = child.textContent?.trim();
              if (text) {
                textRuns.push(new TextRun({ 
                  text,
                  font: 'Calibri',
                  size: 24, // 12pt
                  color: '2F2F2F'
                }));
              }
            } else if (child.nodeType === child.ELEMENT_NODE) {
              const childElement = child as Element;
              const childTagName = childElement.tagName.toLowerCase();
              const text = childElement.textContent?.trim();
              
              if (text) {
                switch (childTagName) {
                  case 'strong':
                  case 'b':
                    textRuns.push(new TextRun({ 
                      text, 
                      bold: true,
                      font: 'Calibri',
                      size: 24,
                      color: '2F2F2F'
                    }));
                    break;
                  case 'em':
                  case 'i':
                    textRuns.push(new TextRun({ 
                      text, 
                      italics: true,
                      font: 'Calibri',
                      size: 24,
                      color: '2F2F2F'
                    }));
                    break;
                  case 'u':
                    textRuns.push(new TextRun({ 
                      text, 
                      underline: { type: UnderlineType.SINGLE },
                      font: 'Calibri',
                      size: 24,
                      color: '2F2F2F'
                    }));
                    break;
                  case 's':
                  case 'strike':
                    textRuns.push(new TextRun({ 
                      text, 
                      strike: true,
                      font: 'Calibri',
                      size: 24,
                      color: '2F2F2F'
                    }));
                    break;
                  case 'code':
                    textRuns.push(new TextRun({ 
                      text, 
                      font: 'Consolas',
                      size: 22, // 11pt
                      color: '2F2F2F',
                      shading: { type: ShadingType.CLEAR, color: 'F5F5F5' }
                    }));
                    break;
                  case 'a':
                    const href = childElement.getAttribute('href');
                    if (href) {
                      textRuns.push(new TextRun({ 
                        text,
                        font: 'Calibri',
                        size: 24,
                        color: '0563C1',
                        underline: { type: UnderlineType.SINGLE }
                      }));
                    } else {
                      textRuns.push(new TextRun({ 
                        text,
                        font: 'Calibri',
                        size: 24,
                        color: '2F2F2F'
                      }));
                    }
                    break;
                  default:
                    textRuns.push(new TextRun({ 
                      text,
                      font: 'Calibri',
                      size: 24,
                      color: '2F2F2F'
                    }));
                }
              }
            }
          });
          
          if (textRuns.length > 0) {
            results.push(new Paragraph({ 
              children: textRuns,
              spacing: { before: 120, after: 120 }, // 6pt before and after
              alignment: AlignmentType.JUSTIFIED,
              indent: { firstLine: 0 }
            }));
          }
          break;

        case 'ul':
          element.querySelectorAll('li').forEach((li, index) => {
            results.push(new Paragraph({
              children: [
                new TextRun({
                  text: '• ',
                  font: 'Calibri',
                  size: 24,
                  color: '2F2F2F'
                }),
                new TextRun({
                  text: li.textContent || '',
                  font: 'Calibri',
                  size: 24,
                  color: '2F2F2F'
                })
              ],
              spacing: { before: 60, after: 60 }, // 3pt before and after
              indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) }
            }));
          });
          break;

        case 'ol':
          element.querySelectorAll('li').forEach((li, index) => {
            results.push(new Paragraph({
              children: [
                new TextRun({
                  text: `${index + 1}. `,
                  font: 'Calibri',
                  size: 24,
                  color: '2F2F2F',
                  bold: true
                }),
                new TextRun({
                  text: li.textContent || '',
                  font: 'Calibri',
                  size: 24,
                  color: '2F2F2F'
                })
              ],
              spacing: { before: 60, after: 60 }, // 3pt before and after
              indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) }
            }));
          });
          break;

        case 'blockquote':
          results.push(new Paragraph({
            children: [
              new TextRun({
                text: element.textContent || '',
                font: 'Calibri',
                size: 22, // 11pt
                color: '666666',
                italics: true
              })
            ],
            spacing: { before: 240, after: 240 }, // 12pt before and after
            border: {
              left: { style: BorderStyle.SINGLE, size: 8, color: 'CCCCCC' },
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
            },
            indent: { left: convertInchesToTwip(0.5) },
            shading: { type: ShadingType.CLEAR, color: 'F9F9F9' }
          }));
          break;

        case 'table':
          const tableRows: TableRow[] = [];
          element.querySelectorAll('tr').forEach(tr => {
            const cells: TableCell[] = [];
            tr.querySelectorAll('td, th').forEach(cell => {
              const isHeader = cell.tagName.toLowerCase() === 'th';
              cells.push(new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cell.textContent || '',
                        font: 'Calibri',
                        size: isHeader ? 26 : 24, // 13pt for headers, 12pt for content
                        color: isHeader ? 'FFFFFF' : '2F2F2F',
                        bold: isHeader
                      })
                    ],
                    spacing: { before: 120, after: 120 },
                    alignment: AlignmentType.LEFT
                  })
                ],
                shading: isHeader ? { type: ShadingType.CLEAR, color: '2E5984' } : { type: ShadingType.CLEAR, color: 'FFFFFF' },
                margins: { top: 120, bottom: 120, left: 120, right: 120 }
              }));
            });
            tableRows.push(new TableRow({ children: cells }));
          });
          
          if (tableRows.length > 0) {
            results.push(new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              margins: { top: 240, bottom: 240, left: 0, right: 0 },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
              }
            }));
          }
          break;

        case 'hr':
          results.push(new Paragraph({
            children: [],
            spacing: { before: 360, after: 360 }, // 18pt before and after
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 2, color: '2E5984' },
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

    // Extract document title from content
    const documentTitle = extractDocumentTitle(content);
    
    // Parse HTML content to DOCX elements
    const docxElements = parseHTMLToDocxElements(content);

    // Create document header
    const header = new Header({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: "Business Plan Document",
              font: 'Calibri',
              size: 20, // 10pt
              color: '666666',
              italics: true
            }),
            new Tab(),
            new TextRun({
              children: [PageNumber.CURRENT],
              font: 'Calibri',
              size: 20,
              color: '666666'
            }),
            new TextRun({
              text: " of ",
              font: 'Calibri',
              size: 20,
              color: '666666'
            }),
            new TextRun({
              children: [PageNumber.TOTAL_PAGES],
              font: 'Calibri',
              size: 20,
              color: '666666'
            })
          ],
          tabStops: [
            {
              type: TabStopType.RIGHT,
              position: TabStopPosition.MAX
            }
          ]
        })
      ]
    });

    // Create document footer
    const footer = new Footer({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: "Generated on ",
              font: 'Calibri',
              size: 18, // 9pt
              color: '999999'
            }),
            new TextRun({
              text: new Date().toLocaleDateString(),
              font: 'Calibri',
              size: 18,
              color: '999999'
            }),
            new Tab(),
            new TextRun({
              text: "We Build Trades",
              font: 'Calibri',
              size: 18,
              color: '999999',
              bold: true
            })
          ],
          tabStops: [
            {
              type: TabStopType.RIGHT,
              position: TabStopPosition.MAX
            }
          ]
        })
      ]
    });

    // Create the document
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1)
            },
            size: {
              width: convertInchesToTwip(8.5),
              height: convertInchesToTwip(11)
            }
          }
        },
        headers: {
          default: header
        },
        footers: {
          default: footer
        },
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

    // Create filename using extracted title or fallback to provided filename
    const titleForFilename = documentTitle !== 'document' ? documentTitle : filename;
    const sanitizedFilename = titleForFilename.replace(/[^a-zA-Z0-9\s\-_]/g, '_').replace(/\s+/g, '_');
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
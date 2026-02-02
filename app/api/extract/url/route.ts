import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { JSDOM } from "jsdom";

/** Scrape URL and return content for chatbot base prompts. Same contract as former ai-instructions/scrape-url. */
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

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const unwantedElements = document.querySelectorAll(
      "script, style, nav, footer, header, iframe, noscript, .sidebar, .menu, .navigation, .ads, .advertisement, .banner, .cookie-notice, .popup, .modal, .overlay"
    );
    unwantedElements.forEach((el: Element) => el.remove());

    const title = document.querySelector("title")?.textContent || "";
    let mainContent = "";
    const possibleContentSelectors = [
      "article",
      "main",
      ".content",
      "#content",
      ".main-content",
      "#main-content",
      ".post-content",
      ".article-content",
      ".entry-content",
      ".post-body",
      ".article-body",
      ".story-body",
      ".post",
      ".article",
      ".blog-post",
      ".news-content",
      ".page-content",
    ];

    for (const selector of possibleContentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const paragraphs = element.querySelectorAll("p, h1, h2, h3, h4, h5, h6");
        if (paragraphs.length > 0) {
          mainContent = Array.from(paragraphs)
            .map((p) => p.textContent?.trim())
            .filter((text) => text && text.length > 0)
            .join("\n\n");
          break;
        }
      }
    }

    if (!mainContent) {
      const paragraphs = document.querySelectorAll("p");
      if (paragraphs.length > 0) {
        let largestBlock = "";
        let maxLength = 0;
        paragraphs.forEach((p) => {
          const text = p.textContent?.trim() || "";
          if (text.length > maxLength) {
            maxLength = text.length;
            largestBlock = text;
          }
        });
        if (largestBlock) mainContent = largestBlock;
      }
    }

    if (!mainContent) {
      const bodyText = document.body.textContent || "";
      mainContent = bodyText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 50)
        .join("\n\n");
    }

    const cleanedContent = cleanText(mainContent);

    return NextResponse.json({
      content: cleanedContent,
      title,
      url,
      extractionDate: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error scraping URL:", error);
    return NextResponse.json(
      {
        error: "Failed to scrape URL",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "\n")
    .trim()
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .replace(/^\s+|\s+$/gm, "");
}

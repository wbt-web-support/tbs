/**
 * Web Search Tool API for ElevenLabs Voice Agent
 *
 * Searches the internet using Tavily API.
 * Returns search results with titles, URLs, and content snippets.
 */

import {
  validateToolRequest,
  toolErrorResponse,
  toolSuccessResponse,
} from "../_lib/auth";

const TOOL_KEY = "web_search";

type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score: number;
};

type TavilyResponse = {
  results: TavilyResult[];
  query: string;
  answer?: string;
};

export async function POST(req: Request) {
  const auth = await validateToolRequest(req);
  if (!auth.valid) {
    return toolErrorResponse(auth.error || "Unauthorized", 401);
  }

  // Check for Tavily API key
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  if (!tavilyApiKey) {
    console.error("[agent-tools] TAVILY_API_KEY is not configured");
    return toolErrorResponse("Web search is not configured", 500);
  }

  // Parse request body
  let query: string | undefined;
  let maxResults = 5;

  try {
    const body = await req.json();
    query = body.query;
    if (body.max_results) maxResults = Math.min(body.max_results, 10);
  } catch {
    return toolErrorResponse("Invalid request body", 400);
  }

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return toolErrorResponse("Query parameter is required", 400);
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query: query.trim(),
        max_results: maxResults,
        search_depth: "basic",
        include_answer: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[agent-tools] Tavily API error:", errorText);
      return toolErrorResponse("Web search failed", 502);
    }

    const data: TavilyResponse = await response.json();

    // Format results for the agent
    const results = data.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
    }));

    return toolSuccessResponse(
      {
        results,
        answer: data.answer,
        query: data.query,
      },
      {
        count: results.length,
        scope: "all",
        tool_key: TOOL_KEY,
      }
    );
  } catch (error) {
    console.error("[agent-tools] Web search error:", error);
    return toolErrorResponse("Web search failed", 500);
  }
}

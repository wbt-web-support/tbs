import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { AI_CONFIG_KEYS } from "@/lib/ai-config";

const ALL_KEYS = Object.values(AI_CONFIG_KEYS);

/** Fallback list when OPENROUTER_API_KEY is not set — common OpenRouter model IDs. */
const FALLBACK_MODELS: { id: string; name: string }[] = [
  { id: "openai/gpt-4o", name: "OpenAI GPT-4o" },
  { id: "openai/gpt-4o-mini", name: "OpenAI GPT-4o Mini" },
  { id: "openai/gpt-4-turbo", name: "OpenAI GPT-4 Turbo" },
  { id: "google/gemini-2.0-flash-001", name: "Google Gemini 2.0 Flash" },
  { id: "google/gemini-flash-1.5", name: "Google Gemini Flash 1.5" },
  { id: "anthropic/claude-3.5-sonnet", name: "Anthropic Claude 3.5 Sonnet" },
  { id: "anthropic/claude-3-haiku", name: "Anthropic Claude 3 Haiku" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Meta Llama 3.3 70B" },
];

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 as const };
  }
  const { data: user } = await supabase
    .from("business_info")
    .select("role")
    .eq("user_id", session.user.id)
    .single();
  if (user?.role !== "super_admin") {
    return { error: "Forbidden", status: 403 as const };
  }
  return { supabase };
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;

  try {
    const { data: rows, error } = await supabase
      .from("ai_config")
      .select("key, value")
      .in("key", ALL_KEYS);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const config: Record<string, string> = {};
    (rows || []).forEach((r: { key: string; value: string }) => {
      config[r.key] = r.value;
    });

    let models: { id: string; name?: string }[] = [];
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (apiKey) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          const json = await res.json();
          models = (json.data || []).map((m: { id: string; name?: string }) => ({
            id: m.id,
            name: m.name ?? m.id,
          }));
        }
      } catch (e) {
        console.error("OpenRouter models fetch error:", e);
      }
    }

    if (models.length === 0) {
      models = FALLBACK_MODELS.map((m) => ({ id: m.id, name: m.name }));
    }

    const responseConfig: Record<string, string | null> = {};
    for (const key of ALL_KEYS) {
      responseConfig[key] = config[key]?.trim() ?? null;
    }

    return NextResponse.json({
      config: responseConfig,
      models,
    });
  } catch (e) {
    console.error("GET ai-config error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;

  try {
    const body = await req.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
    }

    const toUpsert: { key: string; value: string }[] = [];
    for (const key of ALL_KEYS) {
      const value = body[key];
      if (value === undefined) continue;
      if (typeof value !== "string" || !value.trim()) {
        return NextResponse.json(
          { error: `${key} must be a non-empty string when provided` },
          { status: 400 }
        );
      }
      toUpsert.push({ key, value: value.trim() });
    }

    if (toUpsert.length === 0) {
      return NextResponse.json({ error: "No valid config keys to update" }, { status: 400 });
    }

    for (const { key, value } of toUpsert) {
      const { error } = await supabase
        .from("ai_config")
        .upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("PATCH ai-config error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { revalidatePath } from "next/cache";
import PromptTable from "./PromptTable";

async function getCurrentUserRole() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;
  const { data: user } = await supabase
    .from("business_info")
    .select("role")
    .eq("user_id", session.user.id)
    .single();
  return user?.role || null;
}

async function getPrompts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prompts")
    .select("id, prompt_key, description, prompt_text, updated_at")
    .order("prompt_key", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function updatePrompt(id: string, description: string, prompt_text: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("prompts")
    .update({ description, prompt_text })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/prompt");
}

export default async function PromptAdminPage() {
  const role = await getCurrentUserRole();
  if (role !== "super_admin") {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center">
        <Card>
                  <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            You must be a super admin to manage prompts.
          </CardDescription>
        </CardHeader>
        </Card>
      </div>
    );
  }

  let prompts: any[] = [];
  let error: any = null;
  try {
    prompts = await getPrompts();
  } catch (e) {
    error = e;
  }

  return (
    <div className="max-w-8xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Prompts</h1>
      <p className="text-muted-foreground mb-8">
        Edit prompts and choose the LLM model per prompt. Changes are live immediately. Use <span className="font-mono bg-neutral-100 px-1 rounded">{'{{companyContext}}'}</span> for dynamic company data.
      </p>

      {error && (
        <div className="text-red-600 mb-4">Error loading prompts: {error.message}</div>
      )}
      <PromptTable prompts={prompts} />
    </div>
  );
} 
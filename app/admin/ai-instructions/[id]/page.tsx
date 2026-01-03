import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { InstructionForm } from "../instruction-form";

export default async function EditAIInstructionPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  
  const { data: instruction, error } = await supabase
    .from("ai_instructions")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !instruction) {
    notFound();
  }

  return <InstructionForm instruction={instruction} />;
}


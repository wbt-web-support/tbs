import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { InstructionForm } from "../instruction-form";

interface Params {
  id: string;
}

interface Props {
  params: Params;
}

export default async function EditInstructionPage({ params }: Props) {
  const supabase = await createClient();
  
  const { data: instruction, error } = await supabase
    .from("chatbot_instructions")
    .select("*")
    .eq("id", params.id)
    .single();
    
  if (error || !instruction) {
    notFound();
  }
  
  return (
    <div className="container max-w-7xl py-6">
      <InstructionForm instruction={instruction} />
    </div>
  );
} 
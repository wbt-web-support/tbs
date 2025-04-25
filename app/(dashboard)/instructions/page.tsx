import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import InstructionsClientContent from "./instructions-client-content";

export default async function InstructionsPage() {
  const supabase = await createClient();

  // First, check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirect("/sign-in");
  }

  // Check if the user is a super_admin
  const { data: userInfo } = await supabase
    .from("business_info")
    .select("role")
    .eq("user_id", user.id)
    .single();

  // If not a super_admin, redirect to dashboard
  if (!userInfo || userInfo.role !== "super_admin") {
    return redirect("/dashboard");
  }

  // Fetch all instructions
  const { data: instructions } = await supabase
    .from("chatbot_instructions")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Chatbot Instructions Management</h1>
      <p className="text-gray-500 mb-8">
        Here you can manage the instructions for the chatbot. These instructions will be used
        for all admin and user interactions with the chatbot.
      </p>
      
      <InstructionsClientContent initialInstructions={instructions || []} />
    </div>
  );
} 
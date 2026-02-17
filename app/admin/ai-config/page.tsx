import { redirect } from "next/navigation";

export default function AiConfigRedirectPage() {
  redirect("/admin/prompt");
}

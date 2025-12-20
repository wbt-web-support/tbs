import { resetPasswordAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function ResetPassword(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  
  // Verify user has a valid session
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    // Redirect to sign-in with error message
    return redirect("/sign-in?error=" + encodeURIComponent("Your session has expired. Please request a new password reset link."));
  }
  
  return (
    <div className="flex min-h-screen w-full bg-gray-100 items-center justify-center p-8">
      <form className="flex flex-col w-full max-w-md bg-white p-8 rounded-lg shadow-sm gap-4">
        <h1 className="text-2xl font-medium">Reset password</h1>
        <p className="text-sm text-foreground/60">
          Please enter your new password below.
        </p>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            name="password"
            placeholder="New password"
            required
            minLength={6}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            placeholder="Confirm password"
            required
            minLength={6}
          />
        </div>
        <SubmitButton formAction={resetPasswordAction} className="w-full">
          Reset password
        </SubmitButton>
        <FormMessage message={searchParams} />
      </form>
    </div>
  );
}

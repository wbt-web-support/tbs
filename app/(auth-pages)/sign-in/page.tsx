import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SmtpMessage } from "../smtp-message";
import Image from "next/image";
import { ForgotPasswordDialog } from "./forgot-password-dialog";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  // Parse error/success/message from query params
  const params = await searchParams;
  let message: Message | null = null;
  if (params.error) {
    message = { error: decodeURIComponent(params.error) };
  } else if (params.success) {
    message = { success: decodeURIComponent(params.success) };
  } else if (params.message) {
    message = { message: decodeURIComponent(params.message) };
  }

  return (
    <div className="flex min-h-screen w-full bg-gray-100">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 bg-white p-8 rounded">
          <div className="flex flex-col items-start justify-start">
            <div className="flex justify-center mb-6 ">
              <Image 
                src="https://tradebusinessschool.com/wp-content/uploads/2024/11/TBS-coloured-logo-1.webp"
                alt="Trades Business School Logo"
                width={130}
                height={60}
                priority
              />
            </div>
            <h1 className="text-2xl font-bold text-left text-black-800">Command HQ</h1>
            <p className="mt-2 text-muted-foreground text-left">
              Your central hub for business growth and success
            </p>
          </div>

          <form className="space-y-6 mb-3">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-800 font-medium">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  className="rounded-xl border-gray-200 focus:border-gray-500 focus:ring-gray-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-gray-800 font-medium">Password</Label>
                  <ForgotPasswordDialog />
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Your password"
                  required
                  className="rounded-xl border-gray-200 focus:border-gray-500 focus:ring-gray-500"
                />
              </div>
            </div>

            {/* Show error/success/message just above the button, compact and prominent */}
            {message && (
              <div className="mb-0">
                <FormMessage message={message} compact />
              </div>
            )}

            <SubmitButton 
              formAction={signInAction} 
              pendingText="Signing in..." 
              className="bg-blue-600 hover:bg-blue-700 text-white w-full rounded-xl py-2.5 transition-colors duration-200 font-medium"
            >
              Sign in
            </SubmitButton>

            {/* <div className="text-sm text-center text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/sign-up" className="text-gray-600 hover:text-gray-800 hover:underline font-medium">
                Sign up
              </Link>
            </div> */}
          </form>
        </div>
      </div>

    </div>
  );
}

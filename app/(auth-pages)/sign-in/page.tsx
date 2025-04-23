import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SmtpMessage } from "../smtp-message";
import { Loader2 } from "lucide-react";

export default async function SignIn(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  if ("message" in searchParams) {
    return (
      <div className="w-full flex-1 flex items-center h-screen sm:max-w-md justify-center gap-2 p-4">
        <FormMessage message={searchParams} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-left">
            <h1 className="text-3xl font-bold">Welcome to Trades Business School Command HQ</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in to access your business management tools
            </p>
          </div>

          <form className="mt-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-blue-600">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  className="border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-blue-600">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Your password"
                  required
                  className="border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <SubmitButton 
              formAction={signInAction} 
              pendingText="Signing in..." 
              className="bg-blue-600 hover:bg-blue-700 text-white w-full"
            >
              Sign in
            </SubmitButton>

            <div className="text-sm text-center text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/sign-up" className="text-blue-600 hover:text-blue-800 hover:underline">
                Sign up
              </Link>
            </div>
          </form>
        </div>
      </div>

      <div className="hidden lg:block lg:w-1/2 bg-blue-50 relative" style={{backgroundImage: 'url(/background.jpg)', backgroundSize: 'cover', backgroundPosition: 'center'}}>
        <div className="absolute inset-0 bg-black bg-opacity-70"></div>
        <div className="h-full flex items-center justify-center p-8 relative z-10">
          <div className="max-w-lg space-y-4">
            <h2 className="text-2xl font-semibold text-white">Business Management Suite</h2>
            <p className="text-white">
              A comprehensive platform for managing your business operations, growth strategies, and team collaboration.
            </p>
            <ul className="space-y-2 text-white">
              <li className="flex items-center gap-2 text-white">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Strategic business planning and execution
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Growth and fulfillment tracking
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Team collaboration and performance metrics
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Comprehensive business analytics
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

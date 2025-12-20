"use client";

import { useState } from "react";
import { forgotPasswordAction } from "@/app/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";

export function ForgotPasswordDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
        >
          Forgot Password?
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Enter your email address and we'll send you a link to reset your password.
          </DialogDescription>
        </DialogHeader>
        <form 
          action={async (formData) => {
            await forgotPasswordAction(formData);
            // Dialog will close automatically on redirect
            setOpen(false);
          }} 
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              className="rounded-xl border-gray-200 focus:border-gray-500 focus:ring-gray-500"
            />
          </div>
          <SubmitButton
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 transition-colors duration-200 font-medium"
            pendingText="Sending..."
          >
            Send Reset Link
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

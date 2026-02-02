"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("fullName")?.toString();
  const businessName = formData.get("businessName")?.toString();
  const phoneNumber = formData.get("phoneNumber")?.toString();
  const paymentOption = formData.get("paymentOption")?.toString();
  const paymentRemaining = parseFloat(formData.get("paymentRemaining")?.toString() || "0");
  const commandHqLink = formData.get("commandHqLink")?.toString();
  const commandHqCreated = formData.get("commandHqCreated") === "on";
  const gdFolderCreated = formData.get("gdFolderCreated") === "on";
  const meetingScheduled = formData.get("meetingScheduled") === "on";
  
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  if (!email || !password || !fullName || !businessName || !phoneNumber || !paymentOption) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "All fields are required",
    );
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (authError) {
    console.error(authError.code + " " + authError.message);
    return encodedRedirect("error", "/sign-up", authError.message);
  }

  if (authData.user) {
    const { error: businessError } = await supabase
      .from('business_info')
      .insert({
        user_id: authData.user.id,
        full_name: fullName,
        business_name: businessName,
        email: email,
        phone_number: phoneNumber,
        payment_option: paymentOption,
        payment_remaining: paymentRemaining,
        command_hq_link: commandHqLink,
        command_hq_created: commandHqCreated,
        gd_folder_created: gdFolderCreated,
        meeting_scheduled: meetingScheduled,
      });

    if (businessError) {
      console.error(businessError.message);
      return encodedRedirect("error", "/sign-up", "Failed to save business information");
    }
  }

  return encodedRedirect(
    "success",
    "/sign-up",
    "Thanks for signing up! Please check your email for a verification link.",
  );
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", error.message);
  }

  if (data.user) {
    const { data: userData, error: roleError } = await supabase
      .from('business_info')
      .select('role')
      .eq('user_id', data.user.id)
      .single();
    
    if (roleError) {
      console.error("Error fetching user role:", roleError);
    } else if (userData?.role === 'super_admin') {
      return redirect("/admin");
    } else if (userData?.role === 'admin') {
      return redirect("/dashboard");
    } else if (userData?.role === 'user') {
      return redirect("/member/ai");
    }
  }

  return redirect("/dashboard");
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/sign-in", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect(
      "error",
      "/sign-in",
      "Could not reset password. Please try again.",
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/sign-in",
    "Check your email for a link to reset your password.",
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required",
    );
  }

  // Validate password length (Supabase minimum is 6 characters)
  if (password.length < 6) {
    return encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password must be at least 6 characters long",
    );
  }

  if (password !== confirmPassword) {
    return encodedRedirect(
      "error",
      "/protected/reset-password",
      "Passwords do not match",
    );
  }

  // Verify user has a valid session
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    console.error("Password reset error - no valid session:", userError);
    return encodedRedirect(
      "error",
      "/sign-in",
      "Your session has expired. Please request a new password reset link.",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    console.error("Password update error:", error);
    return encodedRedirect(
      "error",
      "/protected/reset-password",
      error.message || "Password update failed. Please try again.",
    );
  }

  return encodedRedirect("success", "/sign-in", "Password updated successfully. Please sign in with your new password.");
};

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};

import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // The `/auth/callback` route is required for the server-side auth flow implemented
  // by the SSR package. It exchanges an auth code for the user's session.
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // If redirecting to reset password, allow it regardless of onboarding status
  if (redirectTo === '/protected/reset-password') {
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }
  
  if (user) {
    // Check user role first
    const { data: userProfile } = await supabase
      .from('business_info')
      .select('role')
      .eq('user_id', user.id)
      .single();

    // Skip onboarding check for super_admin users
    if (userProfile?.role !== 'super_admin') {
      // Check if user needs onboarding
      const { data: onboardingData } = await supabase
        .from('company_onboarding')
        .select('completed')
        .eq('user_id', user.id)
        .single();

      // If onboarding not completed, redirect to onboarding
      if (!onboardingData?.completed) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }
  }

  if (redirectTo) {
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  // Check user role for final redirect
  if (user) {
    const { data: userProfile } = await supabase
      .from('business_info')
      .select('role')
      .eq('user_id', user.id)
      .single();

    // Redirect super_admin to /admin, admin to /thank-you, users with role "user" to /member/dashboard, others to /thank-you
    if (userProfile?.role === 'super_admin') {
      return NextResponse.redirect(`${origin}/admin`);
    }
    if (userProfile?.role === 'admin') {
      return NextResponse.redirect(`${origin}/thank-you`);
    }
    if (userProfile?.role === 'user') {
      return NextResponse.redirect(`${origin}/member/dashboard`);
    }
  }

  // URL to redirect to after sign up process completes
  return NextResponse.redirect(`${origin}/thank-you`);
}

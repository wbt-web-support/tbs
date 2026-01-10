// Removed "use client"; - This is now a Server Component

// Import server-side Supabase client and redirect
import { createClient } from "@/utils/supabase/server";
import { redirect } from 'next/navigation';
import { getTeamId } from "@/utils/supabase/teams";

// Import the new client component
import { ProfileClientContent } from './profile-client-content';

// Import types if needed, or define them if not already shared
// Assuming BusinessInfo is defined in profile-client-content.tsx or a shared types file
// If not, define it here or import it.
interface BusinessInfo {
  id: string;
  user_id: string;
  full_name: string;
  business_name: string;
  email: string;
  phone_number: string;
  payment_option: string;
  payment_remaining: number;
  command_hq_created: boolean;
  gd_folder_created: boolean;
  meeting_scheduled: boolean;
  command_hq_link: string | null;
  profile_picture_url: string | null;
  google_review_link: string | null;
  role?: string;
}

// Make the page component async
export default async function ProfilePage() {
  const supabase = await createClient();
  const { getEffectiveUser } = await import('@/lib/get-effective-user');

  // Get effective user (impersonated if active, otherwise actual user)
  const effectiveUser = await getEffectiveUser();

  // Redirect to login if no user
  if (!effectiveUser) {
    return redirect('/sign-in');
  }

  // Fetch user's role and team info using effective user ID
  const { data: userProfile, error: userError } = await supabase
    .from('business_info')
    .select('role, team_id')
    .eq('user_id', effectiveUser.userId)
    .single();

  if (userError) {
    console.error("Error fetching user profile:", userError);
    return redirect('/sign-in');
  }

  const userRole = userProfile?.role || 'user';
  const teamId = await getTeamId(supabase, effectiveUser.userId);

  // Fetch business info for the admin of the team (company profile)
  const { data: businessInfo, error } = await supabase
    .from('business_info')
    .select('*')
    .eq('user_id', teamId) // Use teamId to fetch the admin's profile
    .maybeSingle(); 

  // Handle potential errors during data fetching
  if (error) {
    console.error("Error fetching business info:", error);
    // Optionally, render an error message to the user
    // return <div>Error loading profile data. Please try again later.</div>;
    // For now, we'll proceed and let the client component handle null initialBusinessInfo
  }

  // Create a user object with effective user ID for the client component
  // Get the auth user for the structure, but use effective user ID
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return redirect('/sign-in');
  }
  
  const effectiveUserForClient = {
    ...authUser,
    id: effectiveUser.userId, // Use effective user ID instead of actual user ID
  };

  // Render the client component, passing the fetched data as props
  return <ProfileClientContent 
    user={effectiveUserForClient} 
    initialBusinessInfo={businessInfo as BusinessInfo | null} 
    userRole={userRole}
    teamId={teamId}
  />;
} 
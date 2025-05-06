// Removed "use client"; - This is now a Server Component

// Import server-side Supabase client and redirect
import { createClient } from "@/utils/supabase/server";
import { redirect } from 'next/navigation';

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
}

// Make the page component async
export default async function ProfilePage() {
  const supabase = await createClient();

  // Fetch user session server-side
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to login if no user
  if (!user) {
    return redirect('/sign-in');
  }

  // Fetch business info for the logged-in user
  // Use select('*') if you need all columns, or specify required ones
  const { data: businessInfo, error } = await supabase
        .from('business_info')
    .select('*') // Or specific columns: 'id, full_name, business_name, ...'
    .eq('user_id', user.id)
    .maybeSingle(); // Use maybeSingle() to handle cases where info might not exist yet

  // Handle potential errors during data fetching
  if (error) {
    console.error("Error fetching business info:", error);
    // Optionally, render an error message to the user
    // return <div>Error loading profile data. Please try again later.</div>;
    // For now, we'll proceed and let the client component handle null initialBusinessInfo
  }

  // Render the client component, passing the fetched data as props
  return <ProfileClientContent user={user} initialBusinessInfo={businessInfo as BusinessInfo | null} />;
} 
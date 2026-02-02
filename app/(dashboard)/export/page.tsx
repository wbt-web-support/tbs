import { createClient } from "@/utils/supabase/server";
import { redirect } from 'next/navigation';
import { getEffectiveUser } from '@/lib/get-effective-user';
import { ExportClientContent } from './export-client-content';

// Make the page component async
export default async function ExportPage() {
  const supabase = await createClient();

  // Get effective user (impersonated if active, otherwise actual user)
  const effectiveUser = await getEffectiveUser();

  // Redirect to login if no user
  if (!effectiveUser) {
    return redirect('/sign-in');
  }

  // Fetch all user data (similar to getUserData function from route.ts)
  try {
    console.log(`🔄 [Export] Fetching data for user: ${effectiveUser.userId}`);

    // Fetch business info
    const { data: businessInfo, error: businessError } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', effectiveUser.userId)
      .single();

    if (businessError && businessError.code !== "PGRST116") {
      console.error("Error fetching business info:", businessError);
    }

    // Fetch data from all relevant tables
    const regularTables = [
      'battle_plan',
      'company_onboarding',
      'hwgt_plan',
      'machines',
      'meeting_rhythm_planner',
      'playbooks',
      'quarterly_sprint_canvas',
      'triage_planner',
      'user_timeline_claims'
    ];

    const regularTablePromises = regularTables.map(table => {
      return supabase
        .from(table)
        .select('*')
        .eq('user_id', effectiveUser.userId)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            console.error(`Error fetching ${table}:`, error);
            return { table, data: [] };
          }
          return { table, data: data || [] };
        });
    });

    // Fetch timeline data (chq_timeline doesn't have user_id)
    const timelinePromise = supabase
      .from('chq_timeline')
      .select('*')
      .order('week_number', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(`Error fetching chq_timeline:`, error);
          return { table: 'chq_timeline', data: [] };
        }
        return { table: 'chq_timeline', data: data || [] };
      });

    const allPromises = [...regularTablePromises, timelinePromise];
    const tableResults = await Promise.all(allPromises);

    // Format the response
    const userData = {
      businessInfo: businessInfo || null,
      additionalData: {} as Record<string, any[]>
    };

    // Add other table data
    tableResults.forEach(({ table, data }) => {
      userData.additionalData[table] = data;
    });

    console.log('✅ [Export] All user data fetched successfully');

    // Get auth user for client component structure
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const effectiveUserForClient = authUser
      ? { ...authUser, id: effectiveUser.userId }
      : { id: effectiveUser.userId, email: effectiveUser.email ?? "", app_metadata: {}, user_metadata: {}, aud: "", created_at: "" } as import("@supabase/supabase-js").User;

    // Render the client component with the fetched data
    return <ExportClientContent user={effectiveUserForClient} userData={userData} />;

  } catch (error) {
    console.error('Error fetching user data for export:', error);
    return (
      <div className="max-w-[1440px] mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Data</h2>
          <p className="text-red-600">
            There was an error loading your data for export. Please try again later.
          </p>
        </div>
      </div>
    );
  }
} 
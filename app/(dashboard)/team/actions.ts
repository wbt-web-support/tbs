'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteTeamMember(businessInfoId: string) {
  const supabase = await createClient()

  try {
    // First, get the user details to get the user_id
    const { data: userData, error: fetchError } = await supabase
      .from('business_info')
      .select('user_id, role')
      .eq('id', businessInfoId)
      .single()

    if (fetchError) {
      console.error('Error fetching user data:', fetchError)
      return { success: false, error: fetchError.message }
    }

    const userId = userData.user_id
    const userRole = userData.role

    console.log(`Starting comprehensive deletion for team member: ${userId}, business_info: ${businessInfoId}`)

    // Step 1: Delete user-specific data (these have CASCADE constraints, but we'll be explicit)
    const deletionSteps = [
      // User-specific data with user_id foreign key
      { table: 'company_onboarding', field: 'user_id', value: userId },
      { table: 'battle_plan', field: 'user_id', value: userId },
      { table: 'hwgt_plan', field: 'user_id', value: userId },
      { table: 'meeting_rhythm_planner', field: 'user_id', value: userId },
      { table: 'playbooks', field: 'user_id', value: userId },
      { table: 'quarterly_sprint_canvas', field: 'user_id', value: userId },
      { table: 'triage_planner', field: 'user_id', value: userId },
      { table: 'user_benefit_claims', field: 'user_id', value: userId },
      { table: 'user_checklist_claims', field: 'user_id', value: userId },
      { table: 'user_timeline_claims', field: 'user_id', value: userId },
      { table: 'machines', field: 'user_id', value: userId },
      { table: 'company_scorecards', field: 'user_id', value: userId },
      { table: 'chat_ideas', field: 'user_id', value: userId },
      { table: 'google_analytics_oauth', field: 'user_id', value: userId },
      { table: 'cache', field: 'user_id', value: userId },
      { table: 'user_points', field: 'user_id', value: userId },
      { table: 'user_achievements', field: 'user_id', value: userId },
      
      // Business info related data
      { table: 'playbook_assignments', field: 'user_id', value: businessInfoId },
      
      // Team-related data (if user is a team admin)
      { table: 'departments', field: 'team_id', value: userId },
      { table: 'course_progress', field: 'team_id', value: userId },
      { table: 'course_assignments', field: 'team_id', value: userId },
      
      // Analytics assignments
      { table: 'superadmin_analytics_assignments', field: 'superadmin_user_id', value: userId },
      { table: 'superadmin_analytics_assignments', field: 'assigned_user_id', value: userId },
      { table: 'superadmin_analytics_properties', field: 'superadmin_user_id', value: userId },
    ]

    // Execute deletions
    for (const step of deletionSteps) {
      try {
        const { error } = await supabase
          .from(step.table)
          .delete()
          .eq(step.field, step.value)
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
          console.warn(`Warning deleting from ${step.table}:`, error)
        } else {
          console.log(`Successfully deleted from ${step.table}`)
        }
      } catch (error) {
        console.warn(`Error deleting from ${step.table}:`, error)
        // Continue with other deletions even if one fails
      }
    }

    // Step 2: Update team members to remove this user as their team admin
    try {
      const { error: teamUpdateError } = await supabase
        .from('business_info')
        .update({ team_id: null })
        .eq('team_id', userId)
      
      if (teamUpdateError) {
        console.warn('Warning updating team members:', teamUpdateError)
      } else {
        console.log('Successfully updated team members')
      }
    } catch (error) {
      console.warn('Error updating team members:', error)
    }

    // Step 3: Update users who have this user as their manager
    try {
      const { error: managerUpdateError } = await supabase
        .from('business_info')
        .update({ manager_id: null })
        .eq('manager_id', businessInfoId)
      
      if (managerUpdateError) {
        console.warn('Warning updating manager relationships:', managerUpdateError)
      } else {
        console.log('Successfully updated manager relationships')
      }
    } catch (error) {
      console.warn('Error updating manager relationships:', error)
    }

    // Step 4: Finally delete the business_info record
    const { error: businessError } = await supabase
      .from('business_info')
      .delete()
      .eq('id', businessInfoId)

    if (businessError) {
      console.error('Error deleting business_info:', businessError)
      return { success: false, error: businessError.message }
    }

    // Step 5: Delete the user from auth.users using admin API
    try {
      // For server actions, we need to make a direct call to the admin API
      const adminResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: For server actions, we can't use the session token directly
          // The admin API will need to handle this differently
        },
        body: JSON.stringify({ userId })
      })

      if (!adminResponse.ok) {
        console.warn('Warning: Could not delete user from auth system')
        // Continue anyway since we've already deleted all the data
      } else {
        console.log('Successfully deleted user from auth system')
      }
    } catch (error) {
      console.warn('Error deleting user from auth system:', error)
      // Continue anyway since we've already deleted all the data
    }

    revalidatePath('/team')
    revalidatePath('/team')
    return { success: true }

  } catch (error) {
    console.error('Error in comprehensive team member deletion:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}  
'use server'

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { sendEmail } from '@/lib/send-email'
import { getInvitationEmailHtml } from '@/lib/email-templates/invitation'
import { revalidatePath } from 'next/cache'

const inviteFormSchema = z.object({
  email: z.string().email({
    message: 'Please enter a valid email address.',
  }),
  password: z.string().min(8, {
    message: 'Password must be at least 8 characters long.',
  }).optional(),
  full_name: z.string().min(1, {
    message: 'Full name is required.',
  }),
  phone_number: z.string().min(1, {
    message: 'Phone number is required.',
  }),
  job_title: z.string().optional(),
  manager_id: z.string().nullable().optional(),
  department_id: z.string().nullable().optional(),
  critical_accountabilities: z.array(z.object({ value: z.string() })).optional(),
  playbook_ids: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
})

type InviteFormValues = z.infer<typeof inviteFormSchema>

async function handlePlaybookAssignments(supabase: any, businessInfoId: string, playbookIds: string[] = []) {
  // First, delete all existing assignments for this user
  const { error: deleteError } = await supabase
    .from('playbook_assignments')
    .delete()
    .eq('user_id', businessInfoId);

  if (deleteError) {
    console.error('Error clearing playbook assignments:', deleteError);
    throw new Error(`Error clearing playbook assignments: ${deleteError.message}`);
  }

  // If there are no new playbooks to assign, we're done
  if (playbookIds.length === 0) {
    return;
  }

  // Create new assignments
  const assignments = playbookIds.map(playbookId => ({
    user_id: businessInfoId,
    playbook_id: playbookId,
    assignment_type: 'Owner', // Defaulting to 'Owner' as per current UI
  }));

  const { error: insertError } = await supabase
    .from('playbook_assignments')
    .insert(assignments);

  if (insertError) {
    console.error('Error creating new playbook assignments:', insertError);
    throw new Error(`Error creating new playbook assignments: ${insertError.message}`);
  }
}

export async function inviteUser(values: InviteFormValues, editUserId?: string) {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Handle cookie errors
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Handle cookie errors
          }
        },
      },
    }
  )

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: adminBusinessInfo, error: adminError } = await supabase
      .from('business_info')
      .select('role, team_id, business_name, full_name')
      .eq('user_id', session.user.id)
      .single()

    if (adminError || !adminBusinessInfo) {
      return { success: false, error: 'Could not verify admin status.' }
    }

    if (adminBusinessInfo.role !== 'admin' && adminBusinessInfo.role !== 'super_admin') {
      return { success: false, error: 'You are not authorized to invite users.' }
    }

    const validatedData = inviteFormSchema.safeParse(values)
    if (!validatedData.success) {
      return { success: false, error: 'Invalid input.' }
    }
    
    const { 
      email, 
      password, 
      full_name, 
      phone_number, 
      job_title,
      manager_id,
      department_id,
      critical_accountabilities,
      playbook_ids,
      permissions 
    } = validatedData.data

    if (editUserId) {
      // --- UPDATE EXISTING USER ---
      const { error: updateError } = await supabase
        .from('business_info')
        .update({
          full_name,
          phone_number,
          job_title: job_title || '',
          manager_id: manager_id || null,
          department_id: department_id || null,
          critical_accountabilities: critical_accountabilities || [],
          permissions: { pages: permissions || [] },
        })
        .eq('id', editUserId)

      if (updateError) throw new Error(`Error updating user: ${updateError.message}`);

      // Handle playbook assignments
      await handlePlaybookAssignments(supabase, editUserId, playbook_ids || []);

      if (password) {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          }
        )

        const { data: userInfo, error: userError } = await supabase
          .from('business_info')
          .select('user_id')
          .eq('id', editUserId)
          .single()

        if (userError || !userInfo) throw new Error('Could not find user to update password.');

        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
          userInfo.user_id,
          { password }
        )

        if (passwordError) throw new Error(`Error updating password: ${passwordError.message}`);
      }

    } else {
      // --- CREATE NEW USER ---
      if (!password) {
        return { success: false, error: 'Password is required for new users' }
      }

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )

      const { data: createUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (createUserError) throw new Error(`Error creating user: ${createUserError.message}`);

      if (createUserData && createUserData.user) {
        const newUser = createUserData.user;
        const teamId = adminBusinessInfo.team_id || session.user.id;

        const { data: newBusinessInfo, error: createError } = await supabase
          .from('business_info')
          .insert({
            user_id: newUser.id,
            email: email,
            full_name: full_name,
            business_name: adminBusinessInfo.business_name,
            phone_number: phone_number,
            job_title: job_title || '',
            manager_id: manager_id || null,
            department_id: department_id || null,
            critical_accountabilities: critical_accountabilities || [],
            role: 'user',
            team_id: teamId,
            permissions: { pages: permissions || [] },
            payment_option: 'none',
          })
          .select('id')
          .single();

        if (createError || !newBusinessInfo) {
          await supabaseAdmin.auth.admin.deleteUser(newUser.id);
          throw new Error(`Error creating user profile: ${createError?.message}`);
        }
        
        // Handle playbook assignments
        await handlePlaybookAssignments(supabase, newBusinessInfo.id, playbook_ids || []);

        // Send invitation email
        const loginUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/sign-in`;
        const emailHtml = getInvitationEmailHtml({
          invitedBy: adminBusinessInfo.full_name,
          companyName: adminBusinessInfo.business_name,
          userEmail: email,
          userPassword: password,
          loginUrl,
        });

        await sendEmail({
          to: email,
          subject: `You're invited to join ${adminBusinessInfo.business_name}`,
          html: emailHtml,
        });
      }
    }
    revalidatePath('/chain-of-command');
    return { success: true }
  } catch (error: any) {
    console.error('Server Action Error:', error.message);
    return { success: false, error: error.message }
  }
} 
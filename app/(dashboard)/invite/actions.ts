'use server'

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { sendEmail } from '@/lib/send-email'
import { getInvitationEmailHtml } from '@/lib/email-templates/invitation'

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
  permissions: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: 'You have to select at least one permission.',
  }),
})

type InviteFormValues = z.infer<typeof inviteFormSchema>

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
  
  const { email, password, full_name, phone_number, permissions } = validatedData.data

  if (editUserId) {
    const { error: updateError } = await supabase
      .from('business_info')
      .update({
        full_name,
        phone_number,
        permissions: { pages: permissions },
      })
      .eq('id', editUserId)

    if (updateError) {
      return { success: false, error: `Error updating user: ${updateError.message}` }
    }

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

      if (userError || !userInfo) {
        return { success: false, error: 'Could not find user to update password.' }
      }

      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        userInfo.user_id,
        { password }
      )

      if (passwordError) {
        return { success: false, error: `Error updating password: ${passwordError.message}` }
      }
    }

    return { success: true }
  } else {
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

    if (createUserError) {
      return { success: false, error: `Error creating user: ${createUserError.message}` }
    }

    if (createUserData && createUserData.user) {
      const newUser = createUserData.user;
      const teamId = adminBusinessInfo.team_id || session.user.id;

      const { error: createError } = await supabase.from('business_info').insert({
        user_id: newUser.id,
        email: email,
        full_name: full_name,
        business_name: adminBusinessInfo.business_name,
        phone_number: phone_number,
        role: 'user',
        team_id: teamId,
        permissions: { pages: permissions },
        payment_option: 'none',
      });

      if (createError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.id);
        return { success: false, error: `Error creating user profile: ${createError.message}` };
      }
      
      const { error: onboardingError } = await supabase.from('company_onboarding').insert({
        user_id: newUser.id,
        onboarding_data: {},
        completed: true,
      });

      if (onboardingError) {
        console.error('Failed to create completed onboarding record for user:', onboardingError.message);
      }

      // Send invitation email
      const loginUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/sign-in`;
      const emailHtml = getInvitationEmailHtml({
        invitedBy: adminBusinessInfo.full_name,
        companyName: adminBusinessInfo.business_name,
        userEmail: email,
        userPassword: password,
        loginUrl,
      });

      const emailResult = await sendEmail({
        to: email,
        subject: `You're invited to join ${adminBusinessInfo.business_name}`,
        html: emailHtml,
      });

      if (!emailResult.success) {
        console.error('Failed to send invitation email:', emailResult.error);
      }

      return { success: true }
    }
  }

  return { success: false, error: 'An unknown error occurred.' }
} 
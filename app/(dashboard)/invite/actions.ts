'use server'

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import * as z from 'zod'

const inviteFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  permissions: z.array(z.string()),
})

export async function inviteUser(values: z.infer<typeof inviteFormSchema>) {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
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

  // Check if the current user is an admin
  const { data: adminBusinessInfo, error: adminError } = await supabase
    .from('business_info')
    .select('role, team_id, business_name')
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

  const { email, password, permissions } = validatedData.data

  // Create a new Supabase client with the service role key to perform admin actions
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

  // Create the user using the admin client
  const { data: createUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createUserError) {
    return { success: false, error: `Error creating user: ${createUserError.message}` }
  }

  if (createUserData && createUserData.user) {
    // Create business_info for the new user
    const teamId = adminBusinessInfo.team_id || session.user.id
    
    const { error: createError } = await supabase.from('business_info').insert({
      user_id: createUserData.user.id,
      email: email,
      role: 'user',
      team_id: teamId,
      permissions: { pages: permissions },
      business_name: adminBusinessInfo.business_name,
      full_name: email, // Default full_name to email
      phone_number: '0000000000', // Placeholder
      payment_option: 'none', // Placeholder
    })

    if (createError) {
      // If creating the profile fails, we should delete the invited user
      await supabaseAdmin.auth.admin.deleteUser(createUserData.user.id)
      return { success: false, error: `Error creating user profile: ${createError.message}` }
    }

    return { success: true }
  }

  return { success: false, error: 'An unknown error occurred.' }
} 
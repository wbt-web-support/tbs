import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getEffectiveUser } from '@/lib/get-effective-user'
import { getUserRole } from '@/utils/utils'
import InviteClientContent from './invite-client-content'

export default async function InvitePage() {
  const supabase = await createClient()

  const effectiveUser = await getEffectiveUser()

  if (!effectiveUser) {
    return redirect('/sign-in')
  }

  return <InviteClientContent />
} 
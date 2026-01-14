# Impersonation Pattern for Pages

To make any page work with impersonation, follow this simple pattern:

## Server Components

Replace this pattern:
```typescript
const { data: { user } } = await supabase.auth.getUser();
// ... use user.id in queries
```

With this pattern:
```typescript
import { getEffectiveUser } from '@/lib/get-effective-user';

const effectiveUser = await getEffectiveUser();
if (!effectiveUser) return redirect('/sign-in');

// Use effectiveUser.userId instead of user.id in all queries
const { data } = await supabase
  .from('business_info')
  .select('*')
  .eq('user_id', effectiveUser.userId)
  .single();
```

## Client Components

Replace this pattern:
```typescript
const { data: { user } } = await supabase.auth.getUser();
// ... use user.id in queries
```

With this pattern:
```typescript
import { getEffectiveUserId } from '@/lib/get-effective-user-id';

const effectiveUserId = await getEffectiveUserId();
if (!effectiveUserId) return;

// Use effectiveUserId instead of user.id in all queries
const { data } = await supabase
  .from('business_info')
  .select('*')
  .eq('user_id', effectiveUserId)
  .single();
```

## Quick Helper Function

For server components, you can use this helper:

```typescript
import { getEffectiveUserIdServer } from '@/lib/supabase-helpers';

const effectiveUserId = await getEffectiveUserIdServer();
// Then use effectiveUserId in all your queries
```

## Common Tables That Need user_id Filter

These tables should always use effective user ID:
- `business_info`
- `company_onboarding`
- `ai_onboarding_questions`
- `chat_history`
- `battle_plan`
- `machines`
- `meeting_rhythm_planner`
- `playbooks`
- `quarterly_sprint_canvas`
- `triage_planner`
- `google_analytics_tokens`
- `superadmin_analytics_assignments`

## Example: Complete Page Update

**Before:**
```typescript
export default async function MyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/sign-in');
  
  const { data } = await supabase
    .from('business_info')
    .select('*')
    .eq('user_id', user.id)
    .single();
    
  return <div>{data?.full_name}</div>;
}
```

**After:**
```typescript
import { getEffectiveUser } from '@/lib/get-effective-user';

export default async function MyPage() {
  const supabase = await createClient();
  const effectiveUser = await getEffectiveUser();
  if (!effectiveUser) return redirect('/sign-in');
  
  const { data } = await supabase
    .from('business_info')
    .select('*')
    .eq('user_id', effectiveUser.userId) // ← Changed here
    .single();
    
  return <div>{data?.full_name}</div>;
}
```

That's it! Just replace `user.id` with `effectiveUser.userId` (server) or `effectiveUserId` (client).

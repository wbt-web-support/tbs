'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { inviteUser } from './actions'

const pages = [
  'battle-plan',
  'chain-of-command',
  'chat',
  'chat-v2',
  'chq-timeline',
  'company-scorecard',
  'dashboard',
  'export',
  'fulfillment-machine',
  'fulfillment-machine-planner',
  'growth-machine',
  'growth-machine-planner',
  'hwgt-plan',
  'innovation-machine',
  'meeting-rhythm-planner',
  'playbook-planner',
  'profile',
  'quarterly-sprint-canvas',
  'sop',
  'triage-planner',
] as const

const inviteFormSchema = z.object({
  email: z.string().email({
    message: 'Please enter a valid email address.',
  }),
  password: z.string().min(8, {
    message: 'Password must be at least 8 characters long.',
  }),
  permissions: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: 'You have to select at least one permission.',
  }),
})

type InviteFormValues = z.infer<typeof inviteFormSchema>

interface InviteClientContentProps {
  isAdmin: boolean
}

export function InviteClientContent({ isAdmin }: InviteClientContentProps) {
  const { toast } = useToast()

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: '',
      password: '',
      permissions: [],
    },
  })

  async function onSubmit(data: InviteFormValues) {
    const result = await inviteUser(data)

    if (result.success) {
      toast({
        title: 'User Invited',
        description: `An invitation has been sent to ${data.email}.`,
      })
      form.reset()
    } else {
      toast({
        title: 'Error',
        description: result.error || 'An unexpected error occurred.',
        variant: 'destructive',
      })
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p>You are not authorized to view this page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-10">
      <div>
        <h3 className="text-lg font-medium">Invite New User in your company</h3>
        <p className="text-sm text-muted-foreground">
          Invite a new user to your team and set their permissions.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="name@example.com" {...field} />
                </FormControl>
                <FormDescription>The email of the user you want to invite.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormDescription>The initial password for the new user.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="permissions"
            render={() => (
              <FormItem>
                <div className="mb-4">
                  <FormLabel className="text-base">Permissions</FormLabel>
                  <FormDescription>
                    Select the pages the user will have access to.
                  </FormDescription>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {pages.map((page) => (
                    <FormField
                      key={page}
                      control={form.control}
                      name="permissions"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={page}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(page)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, page])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== page
                                        )
                                      )
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal capitalize">
                              {page.replace(/-/g, ' ')}
                            </FormLabel>
                          </FormItem>
                        )
                      }}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Inviting...' : 'Invite User'}
          </Button>
        </form>
      </Form>
    </div>
  )
} 
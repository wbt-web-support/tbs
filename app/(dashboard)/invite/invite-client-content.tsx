'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { inviteUser } from './actions'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long.' }).optional(),
  full_name: z.string().min(1, { message: 'Full name is required.' }),
  phone_number: z.string().min(1, { message: 'Phone number is required.' }),
  permissions: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: 'You have to select at least one permission.',
  }),
})

type FormValues = z.infer<typeof formSchema>

const permissionOptions = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'chq-timeline', label: 'CHQ Timeline' },
  { id: 'chain-of-command', label: 'Chain of Command' },
  { id: 'triage-planner', label: 'Triage Planner' },
  { id: 'battle-plan', label: 'Business Battle Plan' },
  { id: 'growth-machine-planner', label: 'Growth Machine Planner' },
  { id: 'growth-machine', label: 'Growth Machine' },
  { id: 'fulfillment-machine-planner', label: 'Fulfillment Machine Planner' },
  { id: 'fulfillment-machine', label: 'Fulfillment Machine' },
  { id: 'innovation-machine', label: 'Create Innovations' },
  { id: 'playbook-planner', label: 'Playbook & Machine Planner' },
  { id: 'company-scorecard', label: 'Company Scorecard' },
  { id: 'meeting-rhythm-planner', label: 'Meeting Rhythm Planner' },
  { id: 'quarterly-sprint-canvas', label: 'Quarterly Sprint Canvas' },
  { id: 'hwgt-plan', label: 'HWGT Plan' },
  { id: 'users', label: 'User Management' },
]

export default function InviteClientContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editUserId = searchParams.get('edit')
  const supabase = createClient()
  const isEditing = !!editUserId

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      full_name: '',
      phone_number: '',
      permissions: [],
    },
  })

  useEffect(() => {
    if (isEditing) {
      const loadUserData = async () => {
        const { data: userData, error } = await supabase
          .from('business_info')
          .select('*')
          .eq('id', editUserId)
          .maybeSingle()

        if (error || !userData) {
          toast.error('Failed to load user data.')
          router.push('/users')
          return
        }
        
        form.reset({
          email: userData.email,
          full_name: userData.full_name,
          phone_number: userData.phone_number,
          permissions: userData.permissions?.pages || [],
        })
      }
      loadUserData()
    }
  }, [isEditing, editUserId, form, supabase, router])

  async function onSubmit(values: FormValues) {
    const result = await inviteUser(values, editUserId || undefined)
    if (result.success) {
      toast.success(isEditing ? 'User updated successfully' : 'User invited successfully')
      router.push('/users')
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="mx-auto py-12 px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-medium text-gray-900">
          {isEditing ? 'Edit User' : 'Invite User'}
        </h1>
        <p className="mt-2 text-gray-500 text-lg">
          {isEditing
            ? "Update the user's details and page permissions."
            : 'Invite a new user to your team and set their permissions.'}
        </p>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-4">
          <div className="bg-white rounded-xl border border-gray-100 w-1/4">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-medium text-gray-900">User Details</h2>
              <p className="mt-1 text-sm text-gray-500">
                Provide the basic information for the new user.
              </p>
            </div>
            <div className="p-6 space-y-6">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">Full Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="John Doe" 
                        {...field}
                        className="border-gray-200 focus:border-gray-400 focus:ring-gray-400" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">Email Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="john.doe@example.com"
                        {...field}
                        readOnly={isEditing}
                        className={`border-gray-200 focus:border-gray-400 focus:ring-gray-400 ${isEditing ? 'bg-gray-50' : ''}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">Phone Number</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="(123) 456-7890" 
                        {...field}
                        className="border-gray-200 focus:border-gray-400 focus:ring-gray-400" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!isEditing && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700">Temporary Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          {...field}
                          className="border-gray-200 focus:border-gray-400 focus:ring-gray-400" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 w-3/4">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-medium text-gray-900">Page Permissions</h2>
              <p className="mt-1 text-sm text-gray-500">
                Select which pages the user will be able to access.
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {permissionOptions.map((permission) => (
                  <FormField
                    key={permission.id}
                    control={form.control}
                    name="permissions"
                    render={({ field }) => {
                      return (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-100 p-4 hover:bg-gray-50 transition-colors">
                          <div>
                            <FormLabel className="text-sm font-medium text-gray-800 cursor-pointer">
                              {permission.label}
                            </FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value?.includes(permission.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...field.value, permission.id])
                                  : field.onChange(field.value?.filter((value) => value !== permission.id))
                              }}
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </FormControl>
                        </FormItem>
                      )
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-4 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/users')}
              disabled={form.formState.isSubmitting}
              className="border-gray-200 hover:bg-gray-50 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {form.formState.isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? 'Update User' : 'Send Invitation'}
            </Button>
          </div>
            </div>
            
          </div>
          
       
        </form>
      </Form>
    </div>
  )
} 
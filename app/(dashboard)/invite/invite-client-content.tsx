'use client'

import { useEffect, useState } from 'react'
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { inviteUser } from './actions'
import { Loader2, Plus, Trash2, Briefcase, Users, Building, ClipboardList, BookOpen, User, Mail, Phone, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long.' }).optional(),
  full_name: z.string().min(1, { message: 'Full name is required.' }),
  phone_number: z.string().min(1, { message: 'Phone number is required.' }),
  job_title: z.string().optional(),
  manager: z.string().optional(),
  department: z.string().optional(),
  critical_accountabilities: z.array(z.object({ value: z.string() })).optional(),
  playbooks_owned: z.array(z.object({ value: z.string() })).optional(),
  permissions: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: 'You have to select at least one permission.',
  }),
})

type FormValues = z.infer<typeof formSchema>

const DEPARTMENTS = [
  "ACCOUNTING/FINANCE",
  "OPERATIONS",
  "SUCCESS/SUPPORT",
  "TECHNOLOGY/DEVELOPMENT",
  "PRODUCT/PROGRAMS",
  "SALES",
  "MARKETING"
];

const permissionOptions = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'chat', label: 'Chat' },
  { id: 'sop', label: 'Battle Plan' },
  { id: 'chq-timeline', label: 'CHQ Timeline' },
  { id: 'triage-planner', label: 'Triage Planner' },
  { id: 'business-battle-plan', label: 'Business Battle Plan' },
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
      job_title: '',
      manager: '',
      department: '',
      critical_accountabilities: [],
      playbooks_owned: [],
      permissions: [],
    },
  })

  const [newAccountability, setNewAccountability] = useState("");
  const [newPlaybook, setNewPlaybook] = useState("");

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
          router.push('/chain-of-command')
          return
        }
        
        form.reset({
          email: userData.email,
          full_name: userData.full_name,
          phone_number: userData.phone_number,
          job_title: userData.job_title || '',
          manager: userData.manager || '',
          department: userData.department || '',
          critical_accountabilities: userData.critical_accountabilities || [],
          playbooks_owned: userData.playbooks_owned || [],
          permissions: userData.permissions?.pages || [],
        })
      }
      loadUserData()
    }
  }, [isEditing, editUserId, form, supabase, router])

  const handleAddAccountability = () => {
    if (!newAccountability.trim()) return;
    const currentValues = form.getValues('critical_accountabilities') || [];
    form.setValue('critical_accountabilities', [...currentValues, { value: newAccountability.trim() }]);
    setNewAccountability("");
  };

  const handleRemoveAccountability = (index: number) => {
    const currentValues = form.getValues('critical_accountabilities') || [];
    const updated = [...currentValues];
    updated.splice(index, 1);
    form.setValue('critical_accountabilities', updated);
  };

  const handleAddPlaybook = () => {
    if (!newPlaybook.trim()) return;
    const currentValues = form.getValues('playbooks_owned') || [];
    form.setValue('playbooks_owned', [...currentValues, { value: newPlaybook.trim() }]);
    setNewPlaybook("");
  };

  const handleRemovePlaybook = (index: number) => {
    const currentValues = form.getValues('playbooks_owned') || [];
    const updated = [...currentValues];
    updated.splice(index, 1);
    form.setValue('playbooks_owned', updated);
  };

  async function onSubmit(values: FormValues) {
    const result = await inviteUser(values, editUserId || undefined)
    if (result.success) {
      toast.success(isEditing ? 'User updated successfully' : 'User invited successfully')
      router.push('/chain-of-command')
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="mx-auto">
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
          <div className="bg-white rounded-xl border border-gray-100 w-1/3">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-medium text-gray-900">User Details</h2>
              <p className="mt-1 text-sm text-gray-500">
                Provide the basic information for the new user.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      Full Name
                    </FormLabel>
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
                    <FormLabel className="text-gray-700 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-600" />
                      Email Address
                    </FormLabel>
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
                    <FormLabel className="text-gray-700 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-blue-600" />
                      Phone Number
                    </FormLabel>
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
                      <FormLabel className="text-gray-700 flex items-center gap-2">
                        <Lock className="h-4 w-4 text-blue-600" />
                        Temporary Password
                      </FormLabel>
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

              {/* Organizational Information */}
              <Separator className="my-6" />
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Organizational Information</h3>
                
                {/* Job Title */}
                <FormField
                  control={form.control}
                  name="job_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-blue-600" />
                        Job Title
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Sales Manager" 
                          {...field}
                          className="border-gray-200 focus:border-gray-400 focus:ring-gray-400" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Manager */}
                <FormField
                  control={form.control}
                  name="manager"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        Manager
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., John Smith" 
                          {...field}
                          className="border-gray-200 focus:border-gray-400 focus:ring-gray-400" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Department */}
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 flex items-center gap-2">
                        <Building className="h-4 w-4 text-blue-600" />
                        Department
                      </FormLabel>
                      <FormControl>
                        <Select 
                          value={field.value || ""} 
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="border-gray-200 focus:border-gray-400 focus:ring-gray-400">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {DEPARTMENTS.map((dept) => (
                                <SelectItem key={dept} value={dept}>
                                  {dept}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Critical Accountabilities */}
                <FormField
                  control={form.control}
                  name="critical_accountabilities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-blue-600" />
                        Critical Accountabilities
                      </FormLabel>
                      <FormControl>
                        <div className="border rounded-md p-3 space-y-2">
                          {field.value && field.value.length > 0 ? (
                            <div className="space-y-2">
                              {field.value.map((item, index) => (
                                <div key={index} className="flex items-center">
                                  <div className="flex-1 p-2 bg-gray-50 rounded text-sm">
                                    {item.value}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 ml-2"
                                    onClick={() => handleRemoveAccountability(index)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-gray-500 text-sm italic">No accountabilities added yet</div>
                          )}
                          <div className="flex mt-2">
                            <Input
                              value={newAccountability}
                              onChange={(e) => setNewAccountability(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddAccountability();
                                }
                              }}
                              placeholder="Add accountability..."
                              className="flex-1 border-gray-200"
                            />
                            <Button
                              type="button"
                              className="ml-2 bg-blue-600 hover:bg-blue-700"
                              onClick={handleAddAccountability}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Playbooks Owned */}
                <FormField
                  control={form.control}
                  name="playbooks_owned"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                        Playbooks Owned
                      </FormLabel>
                      <FormControl>
                        <div className="border rounded-md p-3 space-y-2">
                          {field.value && field.value.length > 0 ? (
                            <div className="space-y-2">
                              {field.value.map((item, index) => (
                                <div key={index} className="flex items-center">
                                  <div className="flex-1 p-2 bg-gray-50 rounded text-sm">
                                    {item.value}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 ml-2"
                                    onClick={() => handleRemovePlaybook(index)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-gray-500 text-sm italic">No playbooks added yet</div>
                          )}
                          <div className="flex mt-2">
                            <Input
                              value={newPlaybook}
                              onChange={(e) => setNewPlaybook(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddPlaybook();
                                }
                              }}
                              placeholder="Add playbook..."
                              className="flex-1 border-gray-200"
                            />
                            <Button
                              type="button"
                              className="ml-2 bg-blue-600 hover:bg-blue-700"
                              onClick={handleAddPlaybook}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 w-2/3">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-medium text-gray-900">Page Permissions</h2>
              <p className="mt-1 text-sm text-gray-500">
                Select which pages the user will be able to access.
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
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
              onClick={() => router.push('/chain-of-command')}
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
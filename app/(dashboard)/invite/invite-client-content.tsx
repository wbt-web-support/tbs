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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Set to true to show Playbooks Owned section and Playbook permission (hidden for now, enable later)
const SHOW_PLAYBOOKS = false;

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long.' }).optional(),
  full_name: z.string().min(1, { message: 'Full name is required.' }),
  phone_number: z.string().min(1, { message: 'Phone number is required.' }),
  job_title: z.string().optional(),
  manager_id: z.string().nullable().optional(),
  department_id: z.string().nullable().optional(),
  critical_accountabilities: z.array(z.object({ value: z.string() })).optional(),
  playbook_ids: z.array(z.string()).optional(),
  permissions: z.array(z.string()),
})

type FormValues = z.infer<typeof formSchema>

type SelectOption = {
  id: string;
  name: string;
}

const DEPARTMENTS = [
  "ACCOUNTING/FINANCE",
  "OPERATIONS",
  "SUCCESS/SUPPORT",
  "TECHNOLOGY/DEVELOPMENT",
  "PRODUCT/PROGRAMMES",
  "SALES",
  "MARKETING"
];

const permissionOptions = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'chat', label: 'Chat' },
  { id: 'sop', label: 'Battle Plan' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'company-overview', label: 'Company Overview' },
  { id: 'business-plan', label: 'Business Plan' },
  { id: 'growth-machine', label: 'Growth Machine' },
  { id: 'fulfilment-machine', label: 'Fulfilment Machine' },
  ...(SHOW_PLAYBOOKS ? [{ id: 'playbook-planner', label: 'Playbook & Machine Planner' }] : []),
  { id: 'meeting-rhythm-planner', label: 'Meeting Rhythm Planner' },
  { id: 'quarterly-sprint-canvas', label: 'Quarterly Sprint Canvas' },
]

export default function InviteClientContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editUserId = searchParams.get('edit')
  const supabase = createClient()
  const isEditing = !!editUserId

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      email: '',
      password: '',
      full_name: '',
      phone_number: '',
      job_title: '',
      manager_id: '',
      department_id: '',
      critical_accountabilities: [],
      playbook_ids: [],
      permissions: SHOW_PLAYBOOKS ? ['calendar', 'playbook-planner'] : ['calendar'],
    },
  })

  const [newAccountability, setNewAccountability] = useState("");
  const [newPlaybook, setNewPlaybook] = useState("");

  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [teamMembers, setTeamMembers] = useState<SelectOption[]>([]);
  const [playbooks, setPlaybooks] = useState<SelectOption[]>([]);
  const [isEditingAdmin, setIsEditingAdmin] = useState(false);
  const [originalPermissions, setOriginalPermissions] = useState<string[]>([]);
  const [showFullPermissions, setShowFullPermissions] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);

  useEffect(() => {
    const loadAllData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adminBusinessInfo } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', user.id)
        .single();
      
      const teamId = adminBusinessInfo?.team_id || user.id;

      // Fetch Departments, Team Members, and Playbooks first (playbooks only when SHOW_PLAYBOOKS)
      const [departmentsRes, teamMembersRes, playbooksRes] = await Promise.all([
        supabase.from('departments').select('id, name').or(`team_id.eq.${teamId},team_id.eq.00000000-0000-0000-0000-000000000000`),
        supabase.from('business_info').select('id, full_name').eq('team_id', teamId),
        ...(SHOW_PLAYBOOKS ? [supabase.from('playbooks').select('id, playbookname').eq('user_id', user.id)] : [Promise.resolve({ data: [], error: null })])
      ]);
      
      if (departmentsRes.error) console.error('Error fetching departments:', departmentsRes.error);
      else setDepartments(departmentsRes.data || []);

      if (teamMembersRes.error) console.error('Error fetching team members:', teamMembersRes.error);
      else setTeamMembers(teamMembersRes.data.map((tm: { id: any; full_name: any }) => ({ id: tm.id, name: tm.full_name })) || []);

      if (SHOW_PLAYBOOKS && playbooksRes?.error) console.error('Error fetching playbooks:', playbooksRes.error);
      else if (SHOW_PLAYBOOKS && playbooksRes?.data) setPlaybooks(playbooksRes.data.map((p: { id: any; playbookname: any }) => ({ id: p.id, name: p.playbookname })) || []);

      // Now, if editing, fetch the specific user's data and reset the form
      if (isEditing) {
        const selectQuery = SHOW_PLAYBOOKS
          ? `*, playbook_assignments(playbook_id)`
          : `*`;
        const { data: userData, error } = await supabase
          .from('business_info')
          .select(selectQuery)
          .eq('id', editUserId)
          .maybeSingle()

        if (error || !userData) {
          toast.error('Failed to load user data.')
          router.push('/team')
          return
        }
        
        form.reset({
          email: userData.email,
          full_name: userData.full_name,
          phone_number: userData.phone_number,
          job_title: userData.job_title || '',
          manager_id: userData.manager_id,
          department_id: userData.department_id,
          critical_accountabilities: userData.critical_accountabilities || [],
          playbook_ids: SHOW_PLAYBOOKS ? (userData.playbook_assignments?.map((pa: any) => pa.playbook_id) || []) : [],
          permissions: userData.permissions?.pages || [],
        });

        setIsEditingAdmin(userData.role === 'admin');
        if (userData.role === 'admin') {
          setOriginalPermissions(userData.permissions?.pages || []);
        }
      }
    };

    loadAllData();
  }, [isEditing, editUserId, supabase, form, router]);

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
    const currentValues = form.getValues('playbook_ids') || [];
    form.setValue('playbook_ids', [...currentValues, newPlaybook.trim()]);
    setNewPlaybook("");
  };

  const handleRemovePlaybook = (index: number) => {
    const currentValues = form.getValues('playbook_ids') || [];
    const updated = [...currentValues];
    updated.splice(index, 1);
    form.setValue('playbook_ids', updated);
  };

  async function onSubmit(values: FormValues) {
    let finalValues = { ...values };

    if (isEditingAdmin) {
      finalValues.permissions = originalPermissions;
    }
    
    if (!isEditing && (!finalValues.permissions || finalValues.permissions.length === 0)) {
      toast.error("Please select at least one page permission for the new user.");
      return;
    }
    
    const result = await inviteUser(finalValues, editUserId || undefined)
    if (result.success) {
      toast.success(isEditing ? 'User updated successfully' : 'User invited successfully')
      router.push('/team')
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="">
          <div className="flex flex-col gap-6">
          {/* User Details Section */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-medium">User Details</h2>
              <p className="mt-1 text-sm text-gray-500">
                Provide the basic and organisational information for the new user.
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              </div>

              {/* Organisational Information */}
              <Separator className="my-6" />
              <h3 className="text-lg font-medium mb-4">Organisational Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <FormField
                  control={form.control}
                  name="manager_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        Direct Reports
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value || ""}
                          onValueChange={(value) => field.onChange(value === "null" ? null : value)}
                        >
                          <SelectTrigger className="border-gray-200 focus:border-gray-400 focus:ring-gray-400">
                            <SelectValue placeholder="Select direct report" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="null">No Direct Report</SelectItem>
                            {teamMembers.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="department_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 flex items-center gap-2">
                        <Building className="h-4 w-4 text-blue-600" />
                        Department
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value || ""}
                          onValueChange={(value) => field.onChange(value === "null" ? null : value)}
                        >
                          <SelectTrigger className="border-gray-200 focus:border-gray-400 focus:ring-gray-400">
                            <SelectValue placeholder="Select a department" />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="null">No Department</SelectItem>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Playbooks & Accountabilities (Full Width) */}
              <div className="mt-6 space-y-6">
                {SHOW_PLAYBOOKS && (
                  <FormField
                    control={form.control}
                    name="playbook_ids"
                    render={() => (
                      <FormItem>
                        <FormLabel className="text-gray-700 flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-blue-600" />
                          Playbooks Owned
                        </FormLabel>
                        <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                          {playbooks.length > 0 ? (
                            playbooks.map((playbook) => (
                              <FormField
                                key={playbook.id}
                                control={form.control}
                                name="playbook_ids"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={playbook.id}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(playbook.id)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...(field.value || []), playbook.id])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== playbook.id
                                                  )
                                                )
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm font-normal">
                                        {playbook.name}
                                      </FormLabel>
                                    </FormItem>
                                  )
                                }}
                              />
                            ))
                          ) : (
                            <div className="text-center py-4">
                              <BookOpen className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-500 text-sm mb-2">No playbooks available</p>
                              <p className="text-gray-400 text-xs mb-3">Please create a playbook first to assign it to users</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => router.push('/playbook-planner')}
                                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                              >
                                Create Playbook
                              </Button>
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
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
              </div>

              {/* Page Permissions Button */}
              <div className="mt-6 pt-6 border-t border-gray-200 hidden ">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Page Permissions</h3>
                    <p className="text-sm text-gray-500">Configure which pages the user can access</p>
                  </div>
                  <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-gray-300 hover:bg-gray-50"
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Configure Permissions
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Page Permissions</DialogTitle>
                        <DialogDescription>
                          Select which pages the user will be able to access. Default permissions include Calendar access.
                          {SHOW_PLAYBOOKS && ' Playbook access can be enabled when configured.'}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        {!showFullPermissions ? (
                          <div className="space-y-4">
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <div className="ml-3">
                                  <h3 className="text-sm font-medium text-green-800">
                                    Default Permissions Set
                                  </h3>
                                  <div className="mt-1 text-sm text-green-700">
                                    <p>User will have access to:</p>
                                    <ul className="list-disc list-inside mt-1">
                                      <li>Calendar</li>
                                      {SHOW_PLAYBOOKS && <li>Playbook & Machine Planner</li>}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setShowFullPermissions(true)}
                              className="w-full border-gray-300 hover:bg-gray-50"
                            >
                              Override Default Permissions
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <fieldset disabled={isEditingAdmin} className="space-y-4 grid grid-cols-2 gap-4">
                              {isEditingAdmin && (
                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-md">
                                  Page permissions for admin users cannot be changed.
                                </div>
                              )}
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
                            </fieldset>
                            <div className="pt-4 border-t">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowFullPermissions(false)}
                                className="border-gray-300 hover:bg-gray-50"
                              >
                                Use Default Permissions
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </div>

          </div>

          <div className="flex justify-end gap-4 mt-6 border-t pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/team')}
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
        </form>
        
      </Form>
    </div>
  )
} 
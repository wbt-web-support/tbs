"use client";

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MoreHorizontal, Mail, Phone, Building, UserPlus, Loader2, Search, Filter, Briefcase, Users, Building2, BookOpen, ClipboardList } from 'lucide-react'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deleteUser } from './actions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface User {
  id: string
  user_id: string
  email: string
  full_name: string
  business_name: string
  phone_number: string
  role: string
  job_title?: string
  manager?: string
  critical_accountabilities?: { value: string }[]
  playbooks_owned?: { value: string }[]
  department?: string
  permissions: {
    pages: string[]
  }
  created_at: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const loadUsers = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/sign-in')
        return
      }

      const { data: currentUserInfo } = await supabase
        .from('business_info')
        .select('role, team_id')
        .eq('user_id', user.id)
        .single()

      if (!currentUserInfo || (currentUserInfo.role !== 'admin' && currentUserInfo.role !== 'super_admin')) {
        setError('You do not have permission to view this page.')
        setLoading(false)
        return
      }

      const { data: teamUsers, error: teamError } = await supabase
        .from('business_info')
        .select(`
          *,
          job_title,
          manager,
          critical_accountabilities,
          playbooks_owned,
          department
        `)
        .eq('team_id', currentUserInfo.team_id)
        .order('created_at', { ascending: false })

      if (teamError) throw teamError
      setUsers(teamUsers || [])
      setFilteredUsers(teamUsers || [])
    } catch (err: any) {
      setError('Failed to load users')
      console.error('Error loading users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadUsers()
  }, [router, supabase])

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users)
    } else {
      const lowercasedSearch = searchTerm.toLowerCase()
      setFilteredUsers(
        users.filter(
          (user) =>
            user.full_name.toLowerCase().includes(lowercasedSearch) ||
            user.email.toLowerCase().includes(lowercasedSearch) ||
            user.role.toLowerCase().includes(lowercasedSearch) ||
            (user.job_title && user.job_title.toLowerCase().includes(lowercasedSearch)) ||
            (user.department && user.department.toLowerCase().includes(lowercasedSearch)) ||
            (user.manager && user.manager.toLowerCase().includes(lowercasedSearch))
        )
      )
    }
  }, [searchTerm, users])

  const handleDeleteUser = async (userToDelete: User) => {
    if (!confirm(`Are you sure you want to delete ${userToDelete.full_name}? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(userToDelete.id);
    const result = await deleteUser(userToDelete.user_id)
    setIsDeleting(null);

    if (result.success) {
      toast.success('User deleted successfully.');
      await loadUsers();
    } else {
      toast.error(`Failed to delete user: ${result.error}`)
    }
  }

  const handleViewDetails = (user: User) => {
    setSelectedUser(user);
    setDetailsOpen(true);
  }

  const getDepartmentColor = (department: string) => {
    switch (department.toUpperCase()) {
      case "ACCOUNTING/FINANCE":
        return "bg-emerald-100 text-emerald-800";
      case "OPERATIONS":
        return "bg-blue-100 text-blue-800";
      case "SUCCESS/SUPPORT":
        return "bg-purple-100 text-purple-800";
      case "TECHNOLOGY/DEVELOPMENT":
        return "bg-indigo-100 text-indigo-800";
      case "PRODUCT/PROGRAMS":
        return "bg-amber-100 text-amber-800";
      case "SALES":
        return "bg-red-100 text-red-800";
      case "MARKETING":
        return "bg-pink-100 text-pink-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    )
  }
  
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Chain of Command</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your team members, their account access, and organizational structure.
          </p>
        </div>
        <Link href="/invite">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        </Link>
      </div>
      
      <Card className="overflow-hidden shadow-sm border-gray-200">
         <div className="p-4 bg-white border-b border-gray-100 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, role, job title, or department..."
                className="pl-10 pr-4 py-2 w-full border-gray-200 rounded-md focus-visible:ring-blue-600"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center text-sm text-gray-500">
              <Filter className="h-4 w-4 mr-1" />
              {filteredUsers.length} of {users.length} users
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow className="border-b border-gray-200 hover:bg-gray-50/50">
                  <TableHead className="w-[250px] py-3.5 text-sm font-semibold text-gray-700">User Name</TableHead>
                  <TableHead className="py-3.5 text-sm font-semibold text-gray-700">Job Title</TableHead>
                  <TableHead className="py-3.5 text-sm font-semibold text-gray-700">Department</TableHead>
                  <TableHead className="py-3.5 text-sm font-semibold text-gray-700">Playbooks Owned</TableHead>
                  <TableHead className="py-3.5 text-sm font-semibold text-gray-700">Manager</TableHead>
                  <TableHead className="w-[100px] py-3.5 text-sm font-semibold text-gray-700 text-center">Details</TableHead>
                  <TableHead className="w-[120px] py-3.5 text-sm font-semibold text-gray-700 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {user.full_name
                                ? user.full_name
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase()
                                : user.email[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-gray-800">{user.full_name}</div>
                            {/* <div className="text-sm text-muted-foreground">
                              {user.email}
                            </div> */}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {user.job_title || <span className="text-gray-400">—</span>}
                      </TableCell>
                      <TableCell className="py-4">
                        {user.department ? (
                          <Badge variant="outline" className={`text-xs ${getDepartmentColor(user.department)}`}>
                            {user.department}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        {user.playbooks_owned && user.playbooks_owned.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.playbooks_owned.map((pb, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {pb.value}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        {user.manager || <span className="text-gray-400">—</span>}
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">View</Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader className="pb-4 border-b">
                              <div className="flex items-center gap-4">
                                <Avatar className="h-14 w-14">
                                  <AvatarFallback>
                                    {user.full_name
                                      ? user.full_name
                                          .split(' ')
                                          .map((n) => n[0])
                                          .join('')
                                          .toUpperCase()
                                      : user.email[0].toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <DialogTitle className="text-xl font-semibold text-gray-900 mb-1">
                                    {user.full_name}
                                  </DialogTitle>
                                  <p className="text-sm text-gray-500 flex items-center gap-1">
                                    <Mail className="h-4 w-4" /> {user.email}
                                  </p>
                                </div>
                              </div>
                            </DialogHeader>

                            <div className="py-4 space-y-6">
                              {/* Core Info Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Job Title */}
                                <div className="flex items-start gap-2">
                                  <Briefcase className="h-4 w-4 text-blue-600 mt-1" />
                                  <div>
                                    <p className="text-xs text-gray-500">Job Title</p>
                                    <p className="text-sm text-gray-800 font-medium">
                                      {user.job_title || '—'}
                                    </p>
                                  </div>
                                </div>

                                {/* Department */}
                                <div className="flex items-start gap-2">
                                  <Building className="h-4 w-4 text-blue-600 mt-1" />
                                  <div>
                                    <p className="text-xs text-gray-500">Department</p>
                                    {user.department ? (
                                      <Badge variant="outline" className={`text-xs ${getDepartmentColor(user.department)}`}>{user.department}</Badge>
                                    ) : (
                                      <p className="text-sm text-gray-800 font-medium">—</p>
                                    )}
                                  </div>
                                </div>

                                {/* Manager */}
                                <div className="flex items-start gap-2">
                                  <Users className="h-4 w-4 text-blue-600 mt-1" />
                                  <div>
                                    <p className="text-xs text-gray-500">Manager</p>
                                    <p className="text-sm text-gray-800 font-medium">
                                      {user.manager || '—'}
                                    </p>
                                  </div>
                                </div>

                                {/* Phone */}
                                <div className="flex items-start gap-2">
                                  <Phone className="h-4 w-4 text-blue-600 mt-1" />
                                  <div>
                                    <p className="text-xs text-gray-500">Phone</p>
                                    <p className="text-sm text-gray-800 font-medium">
                                      {user.phone_number || '—'}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Playbooks Owned */}
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <BookOpen className="h-4 w-4 text-blue-600" />
                                  <h4 className="text-sm font-semibold text-gray-900">Playbooks Owned</h4>
                                </div>
                                {user.playbooks_owned && user.playbooks_owned.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {user.playbooks_owned.map((pb, idx) => (
                                      <Badge key={idx} variant="secondary" className="text-xs">{pb.value}</Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 italic">None</p>
                                )}
                              </div>

                              {/* Critical Accountabilities */}
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <ClipboardList className="h-4 w-4 text-blue-600" />
                                  <h4 className="text-sm font-semibold text-gray-900">Critical Accountabilities</h4>
                                </div>
                                {user.critical_accountabilities && user.critical_accountabilities.length > 0 ? (
                                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-2">
                                    {user.critical_accountabilities.map((c,i)=>(<li key={i}>{c.value}</li>))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-gray-500 italic">None</p>
                                )}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        {isDeleting === user.id ? (
                           <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => router.push(`/invite?edit=${user.id}`)}
                              >
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive focus:bg-red-50 cursor-pointer"
                                onClick={() => handleDeleteUser(user)}
                                disabled={isDeleting !== null}
                              >
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
      </Card>
    </div>
  )
} 
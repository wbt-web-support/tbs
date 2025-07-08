"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Check, X, Edit, Save, Camera } from "lucide-react";
import { toast } from "sonner";
// Remove SubmitButton import if not used after refactor, keep if needed for forms
// import { SubmitButton } from "@/components/submit-button"; 
import { LoadingSpinner } from "@/components/loading-spinner";
import { DebugSession } from "@/components/debug-session"; // Keep if useful for debugging client side
import type { User } from '@supabase/supabase-js';
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Use the same BusinessInfo interface
interface BusinessInfo {
  id: string;
  user_id: string;
  full_name: string;
  business_name: string;
  email: string;
  phone_number: string;
  payment_option: string;
  payment_remaining: number;
  command_hq_created: boolean;
  gd_folder_created: boolean;
  meeting_scheduled: boolean;
  command_hq_link: string | null;
  profile_picture_url: string | null;
  google_review_link: string | null;
}

interface ProfileClientContentProps {
  user: User;
  initialBusinessInfo: BusinessInfo | null;
  userRole: string;
  teamId: string;
}

export function ProfileClientContent({ user, initialBusinessInfo, userRole, teamId }: ProfileClientContentProps) {
  // const [loading, setLoading] = useState(true); // Removed: Initial loading handled by Server Component
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(initialBusinessInfo);
  const [editing, setEditing] = useState(false);
  const [profileType, setProfileType] = useState<'user' | 'company'>('company'); // Default to company profile
  // Initialize formData with initialBusinessInfo or default values
  const [formData, setFormData] = useState<Partial<BusinessInfo>>(initialBusinessInfo || {
    full_name: '',
    business_name: '',
    email: user.email || '', // Pre-fill email from user object if available
    phone_number: '',
    payment_option: '',
    // Add other fields as necessary with default values
  });
  const supabase = createClient(); // Use client-side Supabase client

  // Fetch user profile data when switching to user profile
  useEffect(() => {
    if (profileType === 'user') {
      fetchUserProfile();
    } else {
      // Reset form data to company profile data when switching back
      setFormData(initialBusinessInfo || {
        full_name: '',
        business_name: '',
        email: user.email || '',
        phone_number: '',
        payment_option: '',
      });
    }
    // Reset editing state when switching profile types
    setEditing(false);
  }, [profileType, initialBusinessInfo, user.email]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('business_info')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }
      
      if (data) {
        setFormData(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return; // Only submit if editing

    setSaving(true);
    try {
      // User ID is available from props
      if (!user) {
        toast.error("User session expired. Please refresh.");
        return;
      }
      
      // Construct the update object, excluding fields that shouldn't be updated directly if needed
      const updateData = { ...formData };
      // delete updateData.id; // Don't update primary key
      // delete updateData.user_id; // Don't update user_id

      // Determine which user_id to update based on profile type
      const targetUserId = profileType === 'user' ? user.id : teamId;

      const { error } = await supabase
        .from('business_info')
        .update(updateData)
        .eq('user_id', targetUserId);

      if (error) {
        console.error('Error updating profile:', error);
        throw new Error(error.message || 'Failed to update profile');
      }

      // Update local state optimistically or after confirmation
      if (profileType === 'user') {
        setFormData(prev => ({ ...prev, ...updateData }));
      } else {
        setBusinessInfo(prev => ({ ...prev, ...updateData } as BusinessInfo));
      }
      setEditing(false);
      toast.success(`${profileType === 'user' ? 'Personal' : 'Company'} profile updated successfully`);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // User ID is available from props
    if (!user) {
      toast.error("User session expired. Please refresh.");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      // Create a path that includes the user's ID as the first folder
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, { 
          upsert: true,
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        throw new Error(uploadError.message || 'Failed to upload profile picture');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      if (!publicUrl) {
        throw new Error('Could not get public URL for the uploaded image.');
      }

      // Determine which user_id to update based on profile type
      const targetUserId = profileType === 'user' ? user.id : teamId;

      const { error: updateError } = await supabase
        .from('business_info')
        .update({ profile_picture_url: publicUrl })
        .eq('user_id', targetUserId);

      if (updateError) {
        console.error('Error updating profile picture URL:', updateError);
        // Attempt to delete the orphaned file from storage
        await supabase.storage.from('profiles').remove([filePath]);
        throw new Error(updateError.message || 'Failed to update profile picture link.');
      }

      // Update local state
      if (profileType === 'user') {
        setFormData(prev => ({ ...prev, profile_picture_url: publicUrl }));
      } else {
        setBusinessInfo(prev => ({ ...prev, profile_picture_url: publicUrl } as BusinessInfo));
      }
      toast.success(`${profileType === 'user' ? 'Personal' : 'Company'} profile picture updated successfully`);
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      toast.error(error.message || 'Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  // Onboarding info state
  const [onboardingInfo, setOnboardingInfo] = useState<any>(null);
  const [editingOnboarding, setEditingOnboarding] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState<any>({});
  const [savingOnboarding, setSavingOnboarding] = useState(false);

  useEffect(() => {
    // Fetch onboarding info
    async function fetchOnboarding() {
      const { data, error } = await supabase
        .from('company_onboarding')
        .select('onboarding_data')
        .eq('user_id', user.id)
        .single();
      if (data?.onboarding_data) {
        setOnboardingInfo(data.onboarding_data);
        setOnboardingForm(data.onboarding_data);
      }
    }
    fetchOnboarding();
  }, [user.id]);

  const handleOnboardingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setOnboardingForm((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleOnboardingSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOnboarding(true);
    try {
      const { error } = await supabase
        .from('company_onboarding')
        .update({ onboarding_data: onboardingForm })
        .eq('user_id', user.id);
      if (error) throw error;
      setOnboardingInfo(onboardingForm);
      setEditingOnboarding(false);
      toast.success('Onboarding info updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update onboarding info');
    } finally {
      setSavingOnboarding(false);
    }
  };

  // Removed initial loading state return

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-4xl mx-auto">
        {/* <DebugSession /> Consider passing session from server if needed */} 
        
        {/* Profile Tabs - Only show for user role, else just company profile */}
        {userRole === 'user' ? (
          <Tabs value={profileType} onValueChange={val => setProfileType(val as 'user' | 'company')} className="w-full mb-6">
            <TabsList className="w-full flex justify-center mb-2">
              <TabsTrigger value="user" className="flex-1">My Profile</TabsTrigger>
              <TabsTrigger value="company" className="flex-1">Company Profile</TabsTrigger>
            </TabsList>
            <TabsContent value="user">
              {/* My Profile Content */}
              {renderProfileForm('user')}
            </TabsContent>
            <TabsContent value="company">
              {/* Company Profile Content */}
              {renderProfileForm('company')}
            </TabsContent>
          </Tabs>
        ) : (
          // Only show company profile for admin/super_admin
          renderProfileForm('company')
        )}
      </div>
    </div>
  );

  // Helper to render the profile form for each tab
  function renderProfileForm(type: 'user' | 'company') {
    return (
      <Card className="border-0 overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl font-semibold">
                {type === 'user' ? 'My Profile' : 'Company Profile'}
              </CardTitle>
              <CardDescription className="text-sm text-gray-500">
                {type === 'user' 
                  ? 'Manage your personal information' 
                  : 'Manage your business information'
                }
              </CardDescription>
            </div>
            <Button 
              variant={editing ? "secondary" : "outline"} 
              size="sm"
              onClick={() => setEditing(!editing)}
              disabled={saving}
            >
              {editing ? 
                <><X className="h-4 w-4 mr-1.5" /> Cancel</> : 
                <><Edit className="h-4 w-4 mr-1.5" /> Edit</>
              }
            </Button>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Profile Picture Section */} 
              <div className="flex flex-col items-center md:items-start gap-3">
                <div className="relative group">
                  <Avatar className="h-28 w-28 rounded-full border-2 border-white -md">
                    <AvatarImage 
                      src={type === 'user' ? formData.profile_picture_url || '' : businessInfo?.profile_picture_url || ''} 
                      alt={type === 'user' ? formData.full_name || 'User' : businessInfo?.business_name || 'User'} 
                    />
                    <AvatarFallback className="text-2xl bg-blue-100 text-blue-700 font-medium">
                      {type === 'user' 
                        ? formData.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()
                        : businessInfo?.business_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()
                      }
                    </AvatarFallback>
                  </Avatar>
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
                      <LoadingSpinner size="md" className="text-white" />
                    </div>
                  )}
                  <label
                    htmlFor="profile-picture"
                    className={`absolute bottom-1 right-1 bg-white p-2 rounded-full cursor-pointer hover:bg-gray-100 transition-colors  border border-gray-200 ${uploading ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <Camera className="h-4 w-4 text-gray-600" />
                  </label>
                  <input
                    id="profile-picture"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </div>
                <p className="text-xs text-gray-500 text-center md:text-left">Upload a profile picture</p>
              </div>

              {/* Form Fields Section */} 
              <div className="flex-1 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                  {type === 'user' ? (
                    // User Profile Fields
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="full_name" className="text-sm font-medium text-gray-700">Full Name</Label>
                        <Input
                          id="full_name"
                          name="full_name"
                          value={formData.full_name || ''}
                          onChange={handleInputChange}
                          disabled={!editing || saving}
                          className="h-10"
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email || ''}
                          onChange={handleInputChange}
                          disabled // Generally email shouldn't be editable here, depends on auth setup
                          className="h-10 bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="phone_number" className="text-sm font-medium text-gray-700">Phone Number</Label>
                        <Input
                          id="phone_number"
                          name="phone_number"
                          value={formData.phone_number || ''}
                          onChange={handleInputChange}
                          disabled={!editing || saving}
                          className="h-10"
                          placeholder="Enter phone number"
                        />
                      </div>
                    </>
                  ) : (
                    // Company Profile Fields
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="full_name" className="text-sm font-medium text-gray-700">Full Name</Label>
                        <Input
                          id="full_name"
                          name="full_name"
                          value={formData.full_name || ''}
                          onChange={handleInputChange}
                          disabled={!editing || saving}
                          className="h-10"
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="business_name" className="text-sm font-medium text-gray-700">Business Name</Label>
                        <Input
                          id="business_name"
                          name="business_name"
                          value={formData.business_name || ''}
                          onChange={handleInputChange}
                          disabled={!editing || saving}
                          className="h-10"
                          placeholder="Enter your business name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email || ''}
                          onChange={handleInputChange}
                          disabled // Generally email shouldn't be editable here, depends on auth setup
                          className="h-10 bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="phone_number" className="text-sm font-medium text-gray-700">Phone Number</Label>
                        <Input
                          id="phone_number"
                          name="phone_number"
                          value={formData.phone_number || ''}
                          onChange={handleInputChange}
                          disabled={!editing || saving}
                          className="h-10"
                          placeholder="Enter phone number"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="google_review_link" className="text-sm font-medium text-gray-700">Google Review Link</Label>
                        <Input
                          id="google_review_link"
                          name="google_review_link"
                          type="url"
                          value={formData.google_review_link || ''}
                          onChange={handleInputChange}
                          disabled={!editing || saving}
                          className="h-10"
                          placeholder="Enter your Google Business review link (e.g., https://maps.google.com/...)"
                        />
                        <p className="text-xs text-gray-500">
                          This link will be used to fetch and analyze your Google Business reviews for the dashboard.
                        </p>
                      </div>
                    </>
                  )}
                </div>
                {/* Read-only fields - Only show for company profile */} 
                {type === 'company' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-gray-100">
                     <div className="space-y-1.5">
                       <Label className="text-sm font-medium text-gray-700 block">Payment Option</Label>
                       <p className="text-sm text-gray-800 h-10 flex items-center px-3 rounded-md bg-gray-50 border border-gray-200">
                         {businessInfo?.payment_option || 'N/A'}
                       </p>
                     </div>
                      <div className="space-y-1.5">
                       <Label className="text-sm font-medium text-gray-700 block">Payment Remaining</Label>
                       <p className="text-sm text-gray-800 h-10 flex items-center px-3 rounded-md bg-gray-50 border border-gray-200">
                         {businessInfo?.payment_remaining ?? 'N/A'}
                       </p>
                     </div>
                     <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700 block">Command HQ Created</Label>
                        <p className="text-sm text-gray-800 h-10 flex items-center px-3 rounded-md bg-gray-50 border border-gray-200">
                          {businessInfo?.command_hq_created ? <Check className="h-4 w-4 text-green-600 mr-1"/> : <X className="h-4 w-4 text-red-600 mr-1"/>} {businessInfo?.command_hq_created ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700 block">GD Folder Created</Label>
                        <p className="text-sm text-gray-800 h-10 flex items-center px-3 rounded-md bg-gray-50 border border-gray-200">
                          {businessInfo?.gd_folder_created ? <Check className="h-4 w-4 text-green-600 mr-1"/> : <X className="h-4 w-4 text-red-600 mr-1"/>} {businessInfo?.gd_folder_created ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700 block">Meeting Scheduled</Label>
                        <p className="text-sm text-gray-800 h-10 flex items-center px-3 rounded-md bg-gray-50 border border-gray-200">
                          {businessInfo?.meeting_scheduled ? <Check className="h-4 w-4 text-green-600 mr-1"/> : <X className="h-4 w-4 text-red-600 mr-1"/>} {businessInfo?.meeting_scheduled ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                       <Label className="text-sm font-medium text-gray-700 block">Command HQ Link</Label>
                       <p className="text-sm text-gray-800 h-10 flex items-center px-3 rounded-md bg-gray-50 border border-gray-200 truncate">
                         {businessInfo?.command_hq_link ? (
                           <a href={businessInfo.command_hq_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                             {businessInfo.command_hq_link}
                           </a>
                         ) : 'N/A'}
                       </p>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
          {editing && (
            <div className="px-6 py-4 bg-gray-50/50 border-t flex justify-end">
              <Button 
                type="submit"
                disabled={saving || uploading}
              >
                {saving ? <LoadingSpinner className="mr-2" /> : <Save className="h-4 w-4 mr-2"/>}
                Save Changes
              </Button>
            </div>
          )}
        </form>
      </Card>
    );
  }
}
"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Check, X } from "lucide-react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import { LoadingSpinner } from "@/components/loading-spinner";

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
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<BusinessInfo>>({});
  const supabase = createClient();

  useEffect(() => {
    fetchBusinessInfo();
  }, []);

  const fetchBusinessInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('business_info')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setBusinessInfo(data);
      setFormData(data);
    } catch (error) {
      console.error('Error fetching business info:', error);
      toast.error('Failed to load profile information');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('business_info')
        .update(formData)
        .eq('user_id', user.id);

      if (error) throw error;
      
      if (businessInfo) {
        setBusinessInfo({ ...businessInfo, ...formData });
      }
      setEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `profile-pictures/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('business_info')
        .update({ profile_picture_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      if (businessInfo) {
        setBusinessInfo({ ...businessInfo, profile_picture_url: publicUrl });
      }
      toast.success('Profile picture updated successfully');
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-8 max-w-[1400px] mx-auto">
        <Card className="rounded-xl border border-gray-100 shadow-sm bg-white overflow-hidden h-fit">
          <CardHeader className="bg-white border-b border-gray-100">
            <CardTitle className="text-2xl font-semibold text-gray-900">Profile Information</CardTitle>
            <CardDescription className="text-gray-500">Manage your business profile and personal information</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-start gap-8">
              <div className="relative group">
                <div className="relative">
                  <Avatar className="h-32 w-32 rounded-full border-2 border-gray-100 shadow-sm">
                    <AvatarImage src={businessInfo?.profile_picture_url || ''} />
                    <AvatarFallback className="text-2xl bg-blue-50 text-blue-900 rounded-xl">
                      {businessInfo?.full_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-xl">
                      <LoadingSpinner size="sm" className="text-white" />
                    </div>
                  )}
                </div>
                <label
                  htmlFor="profile-picture"
                  className="absolute bottom-0 right-0 bg-white text-gray-700 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors shadow-sm border border-gray-100"
                >
                  <Upload className="h-4 w-4" />
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

              <form onSubmit={handleSubmit} className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="full_name" className="text-gray-700 font-medium">Full Name</Label>
                    <Input
                      id="full_name"
                      name="full_name"
                      value={formData.full_name || ''}
                      onChange={handleInputChange}
                      disabled={!editing}
                      className="rounded-lg border-gray-100 focus:border-blue-500 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business_name" className="text-gray-700">Business Name</Label>
                    <Input
                      id="business_name"
                      name="business_name"
                      value={formData.business_name || ''}
                      onChange={handleInputChange}
                      disabled={!editing}
                      className="rounded-lg border-gray-100 focus:border-blue-500 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-700">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email || ''}
                      onChange={handleInputChange}
                      disabled={!editing}
                      className="rounded-lg border-gray-100 focus:border-blue-500 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone_number" className="text-gray-700">Phone Number</Label>
                    <Input
                      id="phone_number"
                      name="phone_number"
                      value={formData.phone_number || ''}
                      onChange={handleInputChange}
                      disabled={!editing}
                      className="rounded-lg border-gray-100 focus:border-blue-500 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_option" className="text-gray-700">Payment Option</Label>
                    <Input
                      id="payment_option"
                      name="payment_option"
                      value={formData.payment_option || ''}
                      onChange={handleInputChange}
                      disabled={!editing}
                      className="rounded-lg border-gray-100 focus:border-blue-500 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_remaining" className="text-gray-700">Payment Remaining</Label>
                    <Input
                      id="payment_remaining"
                      name="payment_remaining"
                      type="number"
                      step="0.01"
                      value={formData.payment_remaining || 0}
                      onChange={handleInputChange}
                      disabled={!editing}
                      className="rounded-lg border-gray-100 focus:border-blue-500 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="command_hq_link" className="text-gray-700">Command HQ Link</Label>
                    <Input
                      id="command_hq_link"
                      name="command_hq_link"
                      value={formData.command_hq_link || ''}
                      onChange={handleInputChange}
                      disabled={!editing}
                      className="rounded-lg border-gray-100 focus:border-blue-500 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-6">
                  {editing ? (
                    <>
                      <SubmitButton 
                        type="submit" 
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        pendingText="Saving changes..."
                        disabled={saving}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Save Changes
                      </SubmitButton>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditing(false);
                          setFormData(businessInfo || {});
                        }}
                        disabled={saving}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Edit Profile
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-gray-100 shadow-sm bg-white overflow-hidden h-fit">
          <CardHeader className="bg-white border-b border-gray-100">
            <CardTitle className="text-2xl font-semibold text-gray-900">Progress Tracking</CardTitle>
            <CardDescription className="text-gray-500">Monitor your business setup progress</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                <span className="text-gray-700 font-medium">Command HQ Created</span>
                <div className={`h-3 w-3 rounded-full ${businessInfo?.command_hq_created ? 'bg-green-500' : 'bg-gray-200'}`} />
              </div>
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                <span className="text-gray-700 font-medium">GD Folder Created</span>
                <div className={`h-3 w-3 rounded-full ${businessInfo?.gd_folder_created ? 'bg-green-500' : 'bg-gray-200'}`} />
              </div>
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                <span className="text-gray-700 font-medium">3-1 Meeting Scheduled</span>
                <div className={`h-3 w-3 rounded-full ${businessInfo?.meeting_scheduled ? 'bg-green-500' : 'bg-gray-200'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
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
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-medium">Profile</CardTitle>
            <CardDescription>Manage your business information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="relative group">
                <div className="relative">
                  <Avatar className="h-24 w-24 rounded-full border border-gray-100">
                    <AvatarImage src={businessInfo?.profile_picture_url || ''} />
                    <AvatarFallback className="text-xl bg-blue-50 text-blue-900">
                      {businessInfo?.full_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                      <LoadingSpinner size="sm" className="text-white" />
                    </div>
                  )}
                  <label
                  htmlFor="profile-picture"
                  className="absolute bottom-0 right-0 bg-white p-1.5 rounded-full cursor-pointer hover:bg-gray-50 transition-colors shadow-sm border border-gray-100"
                >
                  <Upload className="h-3.5 w-3.5" />
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
                
              </div>

              <form onSubmit={handleSubmit} className="flex-1 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="full_name" className="text-sm text-gray-600">Full Name</Label>
                    <Input
                      id="full_name"
                      name="full_name"
                      value={formData.full_name || ''}
                      onChange={handleInputChange}
                      disabled={!editing}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="business_name" className="text-sm text-gray-600">Business Name</Label>
                    <Input
                      id="business_name"
                      name="business_name"
                      value={formData.business_name || ''}
                      onChange={handleInputChange}
                      disabled={!editing}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm text-gray-600">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email || ''}
                      onChange={handleInputChange}
                      disabled={!editing}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone_number" className="text-sm text-gray-600">Phone Number</Label>
                    <Input
                      id="phone_number"
                      name="phone_number"
                      value={formData.phone_number || ''}
                      onChange={handleInputChange}
                      disabled={!editing}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="payment_option" className="text-sm text-gray-600">Payment Option</Label>
                    <Input
                      id="payment_option"
                      name="payment_option"
                      value={formData.payment_option || ''}
                      onChange={handleInputChange}
                      disabled={!editing}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="payment_remaining" className="text-sm text-gray-600">Payment Remaining</Label>
                    <Input
                      id="payment_remaining"
                      name="payment_remaining"
                      type="number"
                      step="0.01"
                      value={formData.payment_remaining || 0}
                      onChange={handleInputChange}
                      disabled={!editing}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="command_hq_link" className="text-sm text-gray-600">Command HQ Link</Label>
                    <Input
                      id="command_hq_link"
                      name="command_hq_link"
                      value={formData.command_hq_link || ''}
                      onChange={handleInputChange}
                      disabled={!editing}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  {editing ? (
                    <>
                      <SubmitButton 
                        type="submit" 
                        className="h-9 bg-blue-600 hover:bg-blue-700 text-white"
                        pendingText="Saving..."
                        disabled={saving}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Save
                      </SubmitButton>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditing(false);
                          setFormData(businessInfo || {});
                        }}
                        disabled={saving}
                        className="h-9"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="h-9 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Edit Profile
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
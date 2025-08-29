"use client";

import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  Calendar, 
  CheckCircle2,
  Loader2,
  Clock,
  Building,
  BadgeCheck,
  FileText,
  BriefcaseBusiness
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";

type BusinessInfo = {
  id: string;
  full_name: string;
  business_name: string;
  email: string;
  phone_number: string;
  payment_option: string;
  payment_remaining: number;
  command_hq_link: string | null;
  command_hq_created: boolean;
  gd_folder_created: boolean;
  meeting_scheduled: boolean;
  profile_picture_url: string | null;
  role: 'super_admin' | 'admin' | 'user';
};

export default function ContactInfo() {
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchBusinessInfo();
  }, []);

  const fetchBusinessInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data, error } = await supabase
        .from('business_info')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setBusinessInfo(data);
    } catch (error) {
      console.error('Error fetching business info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!businessInfo) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No business information found.</p>
      </div>
    );
  }

  const initials = businessInfo.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const statusItems = [
    {
      label: "Command HQ",
      status: businessInfo.command_hq_created,
      icon: Globe,
      description: "Website platform setup"
    },
    {
      label: "Google Drive",
      status: businessInfo.gd_folder_created,
      icon: Building2,
      description: "Resources & documents"
    },
    {
      label: "Meeting",
      status: businessInfo.meeting_scheduled,
      icon: Calendar,
      description: "Kickoff consultation"
    },
  ];

  // Calculate progress percentage for setup status
  const completedSetupCount = statusItems.filter(item => item.status).length;
  const setupProgressPercentage = (completedSetupCount / statusItems.length) * 100;

  return (
    <div className="space-y-4 sm:space-y-6">

   {/* Profile Card */}
   <Card className="p-4 sm:p-6 border-blue-100 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 sm:w-40 sm:h-40 bg-blue-50 rounded-full -mt-16 -mr-16 sm:-mt-20 sm:-mr-20 opacity-30" />
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-blue-100 mx-auto sm:mx-0">
            <AvatarImage
              src={businessInfo.profile_picture_url || undefined}
              alt={businessInfo.full_name}
            />
            <AvatarFallback className="text-lg sm:text-xl bg-blue-100 text-blue-600">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="space-y-2 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl font-semibold">{businessInfo.full_name}</h2>
              <Badge variant="outline" className="capitalize bg-blue-50 border-blue-200 text-blue-700 text-xs sm:text-sm">
                {businessInfo.role}
              </Badge>
            </div>
            
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <BriefcaseBusiness className="w-4 h-4 text-blue-600" />
              <p className="text-muted-foreground text-sm sm:text-base">{businessInfo.business_name}</p>
            </div>
            
            <div className="flex items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>ID: {businessInfo.id.substring(0, 8)}...</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Contact Details */}
      <div className="space-y-3 sm:space-y-4">
        <h3 className="font-semibold flex items-center gap-2 text-base sm:text-lg">
          <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
          <span>Contact Details</span>
        </h3>
        
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
          <Card className="p-3 sm:p-4 hover:shadow-sm transition-shadow duration-200 border-blue-100">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="p-2 sm:p-2.5 rounded-lg bg-blue-50 flex-shrink-0">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Email Address</p>
                <p className="font-medium text-sm sm:text-base truncate">{businessInfo.email}</p>
              </div>
            </div>
          </Card>

          <Card className="p-3 sm:p-4 hover:shadow-sm transition-shadow duration-200 border-blue-100">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="p-2 sm:p-2.5 rounded-lg bg-blue-50 flex-shrink-0">
                <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Phone Number</p>
                <p className="font-medium text-sm sm:text-base truncate">{businessInfo.phone_number}</p>
              </div>
            </div>
          </Card>

          {businessInfo.command_hq_link && (
            <Card className="p-3 sm:p-4 hover:shadow-sm transition-shadow duration-200 border-blue-100 md:col-span-2">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="p-2 sm:p-2.5 rounded-lg bg-blue-50 flex-shrink-0">
                  <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">Command HQ Link</p>
                  <a
                    href={businessInfo.command_hq_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline text-sm sm:text-base truncate block"
                  >
                    View Command HQ →
                  </a>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

   

      {/* Setup Status Card */}
      <Card className="p-4 sm:p-6 border-blue-100 mb-4 sm:mb-6">
        <h3 className="font-semibold flex items-center gap-2 mb-3 sm:mb-4 text-base sm:text-lg">
          <BadgeCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
          <span>Setup Progress</span>
        </h3>
        
        <div className="mb-3 sm:mb-4">
          <div className="h-2 bg-blue-50 rounded-full mb-2">
            <div 
              className="h-2 bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${setupProgressPercentage}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-muted-foreground">{completedSetupCount} of {statusItems.length} completed</span>
            <span className="font-medium text-blue-700">{Math.round(setupProgressPercentage)}%</span>
          </div>
        </div>
        
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {statusItems.map((item) => (
            <Card key={item.label} className={`p-3 sm:p-4 border ${item.status ? 'border-green-100 bg-green-50/30' : 'border-blue-100'}`}>
              <div className="flex items-start gap-2 sm:gap-3">
                <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${item.status ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                  <item.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm sm:text-base">{item.label}</p>
                  <p className="text-xs text-muted-foreground mb-1 sm:mb-2">{item.description}</p>
                  <div className={`flex items-center text-xs sm:text-sm ${item.status ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {item.status ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1" />
                        <span>Completed</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1" />
                        <span>Pending</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
} 
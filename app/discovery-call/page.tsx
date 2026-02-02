'use client';

import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function DiscoveryCallPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [iframeUrl, setIframeUrl] = useState('https://api.leadconnectorhq.com/widget/booking/7sPkfen64Bo3UObW1EWa');

  // Build iframe URL with parameters
  useEffect(() => {
    const baseUrl = 'https://api.leadconnectorhq.com/widget/booking/7sPkfen64Bo3UObW1EWa';
    const params = new URLSearchParams();
    
    // Get parameters from URL
    const firstName = searchParams.get('first_name');
    const lastName = searchParams.get('last_name');
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');
    
    // Add parameters to iframe URL
    if (firstName) params.append('first_name', firstName);
    if (lastName) params.append('last_name', lastName);
    if (email) params.append('email', email);
    if (phone) params.append('phone', phone);
    
    const finalUrl = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
    console.log('Discovery Call URL Parameters:', {
      firstName,
      lastName,
      email,
      phone,
      finalUrl
    });
    setIframeUrl(finalUrl);
  }, [searchParams]);

  // Load the calendar script when component mounts
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://link.msgsndr.com/js/form_embed.js';
    script.type = 'text/javascript';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup script when component unmounts
      const existingScript = document.querySelector('script[src="https://link.msgsndr.com/js/form_embed.js"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  const handleSkipToDashboard = () => {
    // Add URL parameter to indicate fresh onboarding completion and show welcome popup
    router.push('/dashboard?onboarding=completed&welcome=true');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 w-full max-w-6xl mx-auto">
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="text-left mt-10">
         
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Trade Business Bootcamp: 3-1 Strategy Session
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            Trade Business School 60 Minute strategy session With Daniel, Stephen & Al
          </p>
        </div>

        {/* Calendar Container */}
        <div className="mb-6">
          
                     {/* Calendar Iframe */}
           <div className="w-full">
             <iframe 
               src={iframeUrl}
               style={{ width: '100%', border: 'none', overflow: 'hidden' }} 
               scrolling="no" 
               id="QMNTP0yoJPYVYdLveOVB_1767875345713"
               className="min-h-[600px] rounded-lg"
             />
           </div>
        </div>

        {/* Skip Button */}
        <div className="text-center hidden">
          <Button
            onClick={handleSkipToDashboard}
            variant="outline"
            className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Skip for now
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-sm text-gray-500 mt-2">
            You can always schedule this later from your dashboard
          </p>
        </div>
      </div>
    </div>
  );
}

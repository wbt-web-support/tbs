import AIInsights from './ai-insights';
import CustomerReviewsSummary from './customer-reviews-summary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Sparkles, UsersRound, BookOpen, Calendar } from 'lucide-react';

interface DashboardSidebarProps {
  adminProfile: {
    business_name: string;
    google_review_link?: string | null;
  } | null;
  customerReviewsLoading?: boolean;
}

export default function DashboardSidebar({ adminProfile, customerReviewsLoading }: DashboardSidebarProps) {
  return (
    <div className="space-y-6">
      {/* Quick Links Grid */}
          <div className='grid grid-cols-2 gap-4'>
            {/* AI Assistant */}
            <Link href="/chat" className='block'>
              <div className='p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all cursor-pointer group'>
                <div className='flex items-center gap-3'>
                  <div className='p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors'>
                    <Sparkles className='h-5 w-5 text-blue-600' />
                  </div>
                  <h3 className='font-semibold text-gray-900'>AI Assistant</h3>
                </div>
              </div>
            </Link>
            {/* Team */}
            <Link href="/chain-of-command" className='block'>
              <div className='p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-yellow-300 transition-all cursor-pointer group'>
                <div className='flex items-center gap-3'>
                  <div className='p-2 bg-yellow-100 rounded-lg group-hover:bg-yellow-200 transition-colors'>
                    <UsersRound className='h-5 w-5 text-yellow-600' />
                  </div>
                  <h3 className='font-semibold text-gray-900'>Team</h3>
                </div>
              </div>
            </Link>
            {/* Playbook */}
            <Link href="/playbook-planner" className='block'>
              <div className='p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-red-300 transition-all cursor-pointer group'>
                <div className='flex items-center gap-3'>
                  <div className='p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors'>
                    <BookOpen className='h-5 w-5 text-red-600' />
                  </div>
                  <h3 className='font-semibold text-gray-900'>Playbook</h3>
                </div>
              </div>
            </Link>
            {/* Calendar */}
            <Link href="/calendar" className='block'>
              <div className='p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-purple-300 transition-all cursor-pointer group'>
                <div className='flex items-center gap-3'>
                  <div className='p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors'>
                    <Calendar className='h-5 w-5 text-purple-600' />
                  </div>
                  <h3 className='font-semibold text-gray-900'>Calendar</h3>
                </div>
              </div>
            </Link>
          </div>
       
      {/* AI Insights */}
      <AIInsights />

      {/* Customer Reviews Summary */}
      <CustomerReviewsSummary 
        businessName={adminProfile?.business_name || ''}
        googleReviewLink={adminProfile?.google_review_link}
      />
    </div>
  );
} 
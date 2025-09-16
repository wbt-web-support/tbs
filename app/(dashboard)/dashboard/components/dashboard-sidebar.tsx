import AIInsights from './ai-insights';
import CustomerReviewsSummary from './customer-reviews-summary';

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
      {/* AI Insights */}
      <div className="sidebar-ai-insights">
        <AIInsights />
      </div>

      {/* Customer Reviews Summary */}
      <div className="sidebar-reviews-summary">
        <CustomerReviewsSummary 
          businessName={adminProfile?.business_name || ''}
          googleReviewLink={adminProfile?.google_review_link}
        />
      </div>
    </div>
  );
} 
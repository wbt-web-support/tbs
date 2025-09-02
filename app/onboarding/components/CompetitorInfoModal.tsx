import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Globe, Users, Target, TrendingUp, MapPin, Calendar, FileText, Building } from 'lucide-react';

interface CompetitorInfo {
  companyName: string;
  companyOverview: string;
  mainProducts: string;
  targetMarket: string;
  keyStrengths: string;
  competitivePosition: string;
  businessModel: string;
  websiteUrl: string;
  scrapedAt: string;
  rawAnalysis: string;
}

interface CompetitorInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitorInfo: CompetitorInfo | null;
  isLoading?: boolean;
}

export function CompetitorInfoModal({ isOpen, onClose, competitorInfo, isLoading }: CompetitorInfoModalProps) {
  if (!competitorInfo) return null;

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown date';
    }
  };

  const openWebsite = () => {
    if (competitorInfo.websiteUrl) {
      window.open(competitorInfo.websiteUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
                          <div>
                <div className="text-xl font-bold text-gray-900">
                  {competitorInfo.companyName}
                </div>
                <div className="text-sm text-gray-500 font-normal">
                  Competitor Analysis
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Based on AI analysis of company information
                </div>
              </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Analyzing competitor website...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Website Link */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-gray-600" />
                <span className="text-sm text-gray-600">Website analyzed:</span>
                <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
                  {competitorInfo.websiteUrl}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={openWebsite}
                className="flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Visit Site
              </Button>
            </div>

            {/* Analysis Timestamp and Source */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Calendar className="w-4 h-4" />
                <span>Analysis performed on {formatDate(competitorInfo.scrapedAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                <Globe className="w-3 h-3" />
                <span>AI Analysis</span>
              </div>
            </div>

            {/* Key Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Company Overview */}
              <div className="space-y-5">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-blue-600" />
                  Company Overview
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company Description</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-4 rounded-lg leading-relaxed">
                      {competitorInfo.companyOverview}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Main Products/Services</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-4 rounded-lg leading-relaxed">
                      {competitorInfo.mainProducts}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target Market</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-4 rounded-lg leading-relaxed">
                      {competitorInfo.targetMarket}
                    </p>
                  </div>
                </div>
              </div>

              {/* Business Strategy */}
              <div className="space-y-5">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-600" />
                  Business Strategy
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Key Strengths</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-4 rounded-lg leading-relaxed">
                      {competitorInfo.keyStrengths}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Competitive Position</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-4 rounded-lg leading-relaxed">
                      {competitorInfo.competitivePosition}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Business Model</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-4 rounded-lg leading-relaxed">
                      {competitorInfo.businessModel}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Raw Analysis */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                Detailed Analysis
              </h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-700 space-y-4">
                  {competitorInfo.rawAnalysis.split('\n').map((line, index) => {
                    // Check if line starts with a number (like "1.", "2.", etc.)
                    const isNumberedPoint = /^\d+\./.test(line.trim());
                    
                    if (isNumberedPoint) {
                      // Add extra spacing before numbered points
                      return (
                        <div key={index} className="pt-2">
                          <p className="font-medium text-gray-900">{line.trim()}</p>
                        </div>
                      );
                    } else if (line.trim()) {
                      // Regular content with normal spacing
                      return (
                        <p key={index} className="text-gray-700 leading-relaxed">
                          {line.trim()}
                        </p>
                      );
                    } else {
                      // Empty lines - add spacing
                      return <div key={index} className="h-3" />;
                    }
                  })}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={openWebsite} className="bg-blue-600 hover:bg-blue-700">
                <ExternalLink className="w-4 h-4 mr-2" />
                Visit Website
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

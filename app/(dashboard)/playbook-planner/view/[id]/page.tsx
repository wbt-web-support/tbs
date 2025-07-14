"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Edit } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface PlaybookData {
  id: string;
  playbookname: string;
  description: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function PlaybookViewPage() {
  const params = useParams();
  const router = useRouter();
  const [playbook, setPlaybook] = useState<PlaybookData | null>(null);
  const [loading, setLoading] = useState(true);
  
  const supabase = createClient();
  const playbookId = params.id as string;

  useEffect(() => {
    fetchPlaybook();
  }, [playbookId]);

  const fetchPlaybook = async () => {
    try {
      const { data, error } = await supabase
        .from('playbooks')
        .select('id, playbookname, description, content, created_at, updated_at')
        .eq('id', playbookId)
        .single();

      if (error) throw error;

      setPlaybook(data);
    } catch (error) {
      console.error('Error fetching playbook:', error);
      toast({
        title: "Error",
        description: "Failed to load playbook. Please try again.",
        variant: "destructive",
      });
      router.push('/playbook-planner');
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

  if (!playbook) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-gray-900 mb-2">Playbook not found</h2>
        <p className="text-gray-500 mb-4">The playbook you're looking for doesn't exist.</p>
        <Button onClick={() => router.push('/playbook-planner')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Playbooks
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/playbook-planner')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{playbook.playbookname}</h1>
            {playbook.description && (
              <p className="text-sm text-gray-500 mt-1">{playbook.description}</p>
            )}
          </div>
        </div>
        <Button 
          onClick={() => router.push(`/playbook-planner/edit/${playbookId}`)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit Playbook
        </Button>
      </div>

      {/* Content */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {playbook.content ? (
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: playbook.content }}
          />
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p className="mb-4">This playbook doesn't have any content yet.</p>
            <Button 
              onClick={() => router.push(`/playbook-planner/edit/${playbookId}`)}
              variant="outline"
            >
              <Edit className="h-4 w-4 mr-2" />
              Add Content
            </Button>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="mt-6 text-xs text-gray-500 border-t pt-4">
        <div className="flex justify-between">
          <span>Created: {new Date(playbook.created_at).toLocaleDateString()}</span>
          <span>Last updated: {new Date(playbook.updated_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
} 
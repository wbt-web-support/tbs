import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ExternalLink, Edit2, FileText, Info, Users, MessageSquare } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Filters } from "./filters";
import { ChatModalClient } from "./chat-modal-client";

export default async function AIInstructionsPage({
  searchParams,
}: {
  searchParams: { type?: string; search?: string; category?: string; role_access?: string };
}) {
  const supabase = await createClient();
  
  let query = supabase
    .from("ai_instructions")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
    
  if (searchParams.type) {
    query = query.eq("instruction_type", searchParams.type);
  }
  
  if (searchParams.category) {
    query = query.eq("category", searchParams.category);
  }

  if (searchParams.role_access) {
    query = query.eq("role_access", searchParams.role_access);
  }
  
  if (searchParams.search) {
    query = query.ilike("title", `%${searchParams.search}%`);
  }
  
  const { data: instructions } = await query;
  
  // Get counts
  const activeCount = instructions?.filter(i => i.is_active).length || 0;
  const priorityCount = instructions?.filter(i => i.priority > 0).length || 0;
  const adminCount = instructions?.filter(i => i.role_access === 'admin').length || 0;
  const userCount = instructions?.filter(i => i.role_access === 'user').length || 0;
  const allCount = instructions?.filter(i => i.role_access === 'all').length || 0;
  
  // Get category counts
  const categoryCounts = instructions?.reduce((acc, instruction) => {
    const category = instruction.category || 'other';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Category display names
  const categoryDisplayNames: Record<string, string> = {
    'company_info': 'Company Info',
    'product_info': 'Product Info',
    'service_info': 'Service Info',
    'other': 'Other'
  };

  // Role access display names
  const roleAccessDisplayNames: Record<string, string> = {
    'admin': 'Admin Only',
    'user': 'User Only',
    'all': 'All Roles'
  };
    
  return (
    <div className="max-w-[1600px] mx-auto py-0 px-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-1">AI Instructions</h1>
          <p className="text-muted-foreground">
            Manage AI instructions with role-based access and vector embeddings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
              {activeCount} Active
            </div>
            <div className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
              {priorityCount} Prioritised
            </div>
          </div>
          <ChatModalClient />
          <Link href="/admin/ai-instructions/new">
            <Button className="font-medium bg-blue-600 text-white hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Instruction
            </Button>
          </Link>
        </div>
      </div>
      
      <Card className="mb-6 border-neutral-200">
        <CardContent className="p-4">
          <Filters />
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="border-neutral-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{instructions?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-neutral-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">By Role Access</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Admin:</span>
                <span className="font-medium">{adminCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>User:</span>
                <span className="font-medium">{userCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>All:</span>
                <span className="font-medium">{allCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-neutral-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">By Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {Object.entries(categoryDisplayNames).map(([key, label]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span>{label}:</span>
                  <span className="font-medium">{categoryCounts[key] || 0}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-neutral-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {instructions?.length ? Math.round((activeCount / instructions.length) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Card className="border-neutral-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Instructions</CardTitle>
              <CardDescription className="mt-1.5">
                {instructions?.length} total instructions
              </CardDescription>
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mr-1.5" />
              Instructions are ordered by priority, then by creation date
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead>
                <tr className="border-b">
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Title</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Category</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Role Access</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Priority</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Type</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Source</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Content</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Created</th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {instructions?.map((instruction) => (
                  <tr key={instruction.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-4 align-middle font-medium">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[200px]">{instruction.title}</span>
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <Badge variant="outline" className="text-xs">
                        {categoryDisplayNames[instruction.category || 'other']}
                      </Badge>
                    </td>
                    <td className="p-4 align-middle">
                      <Badge variant="outline" className="text-xs">
                        {roleAccessDisplayNames[instruction.role_access || 'all']}
                      </Badge>
                    </td>
                    <td className="p-4 align-middle">
                      <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        instruction.priority === 0 ? 'bg-gray-100 text-gray-700' :
                        instruction.priority === 1 ? 'bg-blue-100 text-blue-700' :
                        instruction.priority === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {instruction.priority === 0 ? 'Normal' :
                         instruction.priority === 1 ? 'High' :
                         instruction.priority === 2 ? 'Very High' :
                         'Critical'}
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-normal bg-background">
                        {instruction.instruction_type}
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      {instruction.instruction_type === 'text' ? (
                        <span className="text-xs text-muted-foreground">Custom Text</span>
                      ) : instruction.url ? (
                        <a href={instruction.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 hover:underline text-xs flex items-center">
                          <ExternalLink className="h-3 w-3 mr-1" />View Source
                        </a>
                      ) : instruction.document_url ? (
                        <a href={instruction.document_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 hover:underline text-xs flex items-center">
                          <FileText className="h-3 w-3 mr-1" />View Document
                        </a>
                      ) : instruction.extraction_metadata?.file_name ? (
                        <span className="text-xs text-muted-foreground truncate max-w-[150px] inline-block">
                          {instruction.extraction_metadata.file_name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-4 align-middle">
                      <div className="max-w-[200px]">
                        <p className="text-xs line-clamp-1 text-muted-foreground">{instruction.content}</p>
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        instruction.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {instruction.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(instruction.created_at), 'MMM d, yyyy')}
                      </span>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/ai-instructions/${instruction.id}`}>
                          <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
                            <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                            Edit
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {!instructions?.length && (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <FileText className="h-10 w-10 mb-4 text-muted-foreground/50" />
                        <p>No instructions found</p>
                        <p className="text-xs mt-1">Try changing your search or filter criteria</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


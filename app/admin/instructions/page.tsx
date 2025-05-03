import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, ExternalLink, Edit2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Filters } from "./filters";
import { ExtractedContentDialog } from "./extracted-content-dialog";

export default async function InstructionsPage({
  searchParams,
}: {
  searchParams: { type?: string; search?: string };
}) {
  const supabase = await createClient();
  
  let query = supabase
    .from("chatbot_instructions")
    .select("*")
    .order("created_at", { ascending: false });
    
  if (searchParams.type) {
    query = query.eq("content_type", searchParams.type);
  }
  
  if (searchParams.search) {
    query = query.ilike("title", `%${searchParams.search}%`);
  }
  
  const { data: instructions } = await query;
    
  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Instructions</h1>
        <Link href="/admin/instructions/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Instruction
          </Button>
        </Link>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-4">
          <Filters />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>All Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Title</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Type</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Source</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Content</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Created</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Updated</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {instructions?.map((instruction) => (
                  <tr key={instruction.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle font-medium">{instruction.title}</td>
                    <td className="p-4 align-middle">
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                        {instruction.content_type}
                      </span>
                    </td>
                    <td className="p-4 align-middle">
                      {instruction.content_type === 'text' ? (
                        <span className="text-xs text-muted-foreground">Custom Text</span>
                      ) : instruction.url ? (
                        <a href={instruction.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs flex items-center">
                          <ExternalLink className="h-3 w-3 mr-1" />View Source
                        </a>
                      ) : instruction.extraction_metadata?.file_name ? (
                        <span className="text-xs text-muted-foreground">
                          {instruction.extraction_metadata.file_name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-4 align-middle">
                      <div className="max-w-[300px]">
                        <p className="text-xs line-clamp-2">{instruction.content}</p>
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        instruction.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {instruction.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(instruction.created_at), 'MMM d, yyyy HH:mm')}
                      </span>
                    </td>
                    <td className="p-4 align-middle">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(instruction.updated_at), 'MMM d, yyyy HH:mm')}
                      </span>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/instructions/${instruction.id}`}>
                          <Button variant="ghost" size="sm">Edit</Button>
                        </Link>
                        {instruction.extraction_metadata && (
                          <ExtractedContentDialog instruction={instruction} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
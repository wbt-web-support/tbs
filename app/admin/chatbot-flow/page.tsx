"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Workflow, MessageSquare } from "lucide-react";
import { TestChatModal } from "./components/TestChatModal";

type Chatbot = {
  id: string;
  name: string;
  base_prompt: string;
  is_active: boolean;
  model_name: string | null;
  created_at: string;
  updated_at: string;
  node_count?: number;
};

export default function ChatbotFlowPage() {
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testChatbot, setTestChatbot] = useState<{ id: string; name: string } | null>(null);

  const fetchChatbots = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chatbot-flow/chatbots");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }
      const data = await res.json();
      setChatbots(data.chatbots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chatbots");
      setChatbots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatbots();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/chatbot-flow/chatbots/${deleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      setDeleteId(null);
      await fetchChatbots();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return s;
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 !pt-6">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-2">
            <Workflow className="h-8 w-8" />
            Chatbot Flow
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage chatbots by selecting nodes (defined in code, one file per node).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/chatbot-flow/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Chatbot
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Chatbots</CardTitle>
          <CardDescription>Edit or delete a chatbot. Click Edit to attach nodes and set the base prompt.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : chatbots.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No chatbots yet. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Nodes</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chatbots.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      {c.is_active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>{c.node_count ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTestChatbot({ id: c.id, name: c.name })}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Test
                      </Button>
                      <Link href={`/admin/chatbot-flow/${c.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setDeleteId(c.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chatbot?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the chatbot and its node links. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {testChatbot && (
        <TestChatModal
          open={!!testChatbot}
          onOpenChange={(open) => !open && setTestChatbot(null)}
          chatbotId={testChatbot.id}
          chatbotName={testChatbot.name}
        />
      )}
    </div>
  );
}

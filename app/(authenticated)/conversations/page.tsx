'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api-client';
import { toast } from '@/lib/hooks/use-toast';
import type { ConversationState } from '@/lib/types';

interface ConversationSummary {
  id: string;
  title: string;
  state: ConversationState;
  createdAt: string;
  updatedAt: string;
  messages: { content: string }[];
}

const stateBadgeColor: Record<ConversationState, string> = {
  IDLE: 'bg-gray-100 text-gray-800',
  LISTENING: 'bg-blue-100 text-blue-800',
  TRANSCRIBING: 'bg-blue-100 text-blue-800',
  INTENT_CLASSIFIED: 'bg-purple-100 text-purple-800',
  CLARIFICATION_REQUIRED: 'bg-yellow-100 text-yellow-800',
  CONFIRMATION_REQUIRED: 'bg-orange-100 text-orange-800',
  READY_TO_EXECUTE: 'bg-green-100 text-green-800',
  EXECUTING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  ERROR: 'bg-red-100 text-red-800',
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.get<{ conversations: ConversationSummary[] }>(
        '/api/conversation/history?limit=50'
      );
      setConversations(data.conversations);
    } catch {
      toast({ title: 'Failed to load conversations', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/conversation/${deleteTarget}`);
      toast({ title: 'Conversation deleted', variant: 'success' });
      setDeleteTarget(null);
      await loadConversations();
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conversations</h1>
        <p className="text-muted-foreground">Your past voice interaction sessions</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="mb-2 h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No conversations yet</p>
            <p className="text-sm text-muted-foreground">
              Start a voice command from the dashboard to create your first conversation
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => (
            <Card key={conv.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{conv.title}</CardTitle>
                    <CardDescription>
                      {new Date(conv.createdAt).toLocaleString()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={stateBadgeColor[conv.state]}>
                      {conv.state}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(conv.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {conv.messages?.[0] && (
                <CardContent className="pt-0">
                  <p className="truncate text-sm text-muted-foreground">
                    {conv.messages[0].content}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              This will permanently delete this conversation and all its messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

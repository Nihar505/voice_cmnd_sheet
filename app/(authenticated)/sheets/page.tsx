'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileSpreadsheet, Plus, ExternalLink, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import type { Spreadsheet } from '@/lib/types';

export default function SheetsPage() {
  const [sheets, setSheets] = useState<Spreadsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [createTitle, setCreateTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingSheet, setEditingSheet] = useState<Spreadsheet | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSheets = useCallback(async () => {
    try {
      const data = await api.get<{ spreadsheets: Spreadsheet[] }>('/api/sheets/list');
      setSheets(data.spreadsheets);
    } catch {
      toast({ title: 'Failed to load sheets', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSheets();
  }, [loadSheets]);

  const handleCreate = async () => {
    if (!createTitle.trim()) return;
    setCreating(true);
    try {
      await api.post('/api/sheets/create', { title: createTitle });
      toast({ title: 'Sheet created', variant: 'success' });
      setCreateTitle('');
      setShowCreate(false);
      await loadSheets();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create sheet';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async () => {
    if (!editingSheet || !editName.trim()) return;
    try {
      await api.put(`/api/sheets/${editingSheet.id}`, { name: editName });
      toast({ title: 'Sheet renamed', variant: 'success' });
      setEditingSheet(null);
      await loadSheets();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to rename';
      toast({ title: msg, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/api/sheets/${id}`);
      toast({ title: 'Sheet removed', variant: 'success' });
      await loadSheets();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Sheets</h1>
          <p className="text-muted-foreground">Manage your connected spreadsheets</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Sheet
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="mb-2 h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sheets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <FileSpreadsheet className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No sheets yet</p>
            <p className="text-sm text-muted-foreground">Create your first sheet to get started</p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Sheet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sheets.map((sheet) => (
            <Card key={sheet.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate text-base">{sheet.name}</CardTitle>
                    <CardDescription>
                      Last accessed:{' '}
                      {new Date(sheet.lastAccessedAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex gap-2">
                {sheet.url && (
                  <a href={sheet.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Open
                    </Button>
                  </a>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingSheet(sheet);
                    setEditName(sheet.name);
                  }}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Rename
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(sheet.id)}
                  disabled={deletingId === sheet.id}
                >
                  {deletingId === sheet.id ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1 h-3 w-3" />
                  )}
                  Remove
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Sheet</DialogTitle>
            <DialogDescription>Enter a title for your new Google Sheet.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Sheet title..."
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !createTitle.trim()}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!editingSheet} onOpenChange={(open) => { if (!open) setEditingSheet(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Sheet</DialogTitle>
            <DialogDescription>Enter a new name for this sheet.</DialogDescription>
          </DialogHeader>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSheet(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!editName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

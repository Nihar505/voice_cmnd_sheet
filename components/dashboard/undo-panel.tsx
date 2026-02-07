'use client';

import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import type { RollbackAction } from '@/lib/types';

interface UndoPanelProps {
  onUndo: (rollbackId: string) => Promise<void>;
}

export function UndoPanel({ onUndo }: UndoPanelProps) {
  const [history, setHistory] = useState<RollbackAction[]>([]);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const data = await api.get<{ undoHistory: RollbackAction[] }>('/api/sheets/undo');
      setHistory(data.undoHistory || []);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleUndo = async (id: string) => {
    setUndoingId(id);
    await onUndo(id);
    setUndoingId(null);
    await loadHistory();
  };

  if (history.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RotateCcw className="h-4 w-4" />
        No undo actions available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((item) => {
        const expiresAt = new Date(item.expiresAt);
        const remainingMs = expiresAt.getTime() - Date.now();
        const remainingMin = Math.max(0, Math.floor(remainingMs / 60000));

        return (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-md border p-2"
          >
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{item.undoAction}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {remainingMin}m remaining
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUndo(item.id)}
              disabled={undoingId === item.id || item.executed}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              {undoingId === item.id ? 'Undoing...' : 'Undo'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

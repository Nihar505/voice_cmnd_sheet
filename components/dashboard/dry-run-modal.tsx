'use client';

import { AlertTriangle, Shield, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DryRunResult } from '@/lib/types';

interface DryRunModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dryRunResult: DryRunResult;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
}

const riskColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

export function DryRunModal({
  open,
  onOpenChange,
  dryRunResult,
  onConfirm,
  onCancel,
  isExecuting,
}: DryRunModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Confirm Action
          </DialogTitle>
          <DialogDescription>{dryRunResult.preview}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Risk Level */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Risk:</span>
            <Badge className={riskColors[dryRunResult.risk_level]}>
              {dryRunResult.risk_level}
            </Badge>
          </div>

          {/* Impact */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              Cells affected: <strong>{dryRunResult.estimated_impact.cells}</strong>
            </span>
            {dryRunResult.reversible && (
              <span className="flex items-center gap-1 text-green-700">
                <RotateCcw className="h-3.5 w-3.5" />
                Reversible
              </span>
            )}
          </div>

          {/* Warnings */}
          {dryRunResult.warnings.length > 0 && (
            <div className="rounded-md bg-yellow-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-yellow-800">
                <AlertTriangle className="h-4 w-4" />
                Warnings
              </div>
              <ul className="mt-1 space-y-1">
                {dryRunResult.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-yellow-700">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isExecuting}>
            Cancel
          </Button>
          <Button
            variant={dryRunResult.risk_level === 'high' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isExecuting}
          >
            {isExecuting ? 'Executing...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

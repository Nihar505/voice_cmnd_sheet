'use client';

import { Loader2, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConversationState } from '@/lib/types';

interface StateIndicatorProps {
  state: ConversationState;
  className?: string;
}

const stateConfig: Record<
  ConversationState,
  { label: string; color: string; icon?: 'spinner' | 'check' | 'alert' }
> = {
  IDLE: { label: 'Ready', color: 'bg-gray-100 text-gray-800' },
  LISTENING: { label: 'Listening...', color: 'bg-blue-100 text-blue-800' },
  TRANSCRIBING: { label: 'Transcribing...', color: 'bg-blue-100 text-blue-800', icon: 'spinner' },
  INTENT_CLASSIFIED: { label: 'Understanding...', color: 'bg-purple-100 text-purple-800' },
  CLARIFICATION_REQUIRED: { label: 'Need Clarification', color: 'bg-yellow-100 text-yellow-800', icon: 'alert' },
  CONFIRMATION_REQUIRED: { label: 'Confirm Action', color: 'bg-orange-100 text-orange-800', icon: 'alert' },
  READY_TO_EXECUTE: { label: 'Ready to Execute', color: 'bg-green-100 text-green-800' },
  EXECUTING: { label: 'Executing...', color: 'bg-blue-100 text-blue-800', icon: 'spinner' },
  COMPLETED: { label: 'Done', color: 'bg-green-100 text-green-800', icon: 'check' },
  ERROR: { label: 'Error', color: 'bg-red-100 text-red-800', icon: 'alert' },
};

export function StateIndicator({ state, className }: StateIndicatorProps) {
  const config = stateConfig[state];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium',
        config.color,
        className
      )}
    >
      {config.icon === 'spinner' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {config.icon === 'check' && <Check className="h-3.5 w-3.5" />}
      {config.icon === 'alert' && <AlertTriangle className="h-3.5 w-3.5" />}
      {!config.icon && state === 'LISTENING' && (
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
      )}
      {!config.icon && state === 'IDLE' && (
        <span className="h-2 w-2 rounded-full bg-gray-400" />
      )}
      {config.label}
    </div>
  );
}

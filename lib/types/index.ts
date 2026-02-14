// Shared type definitions for frontend and API

export type ConversationState =
  | 'IDLE'
  | 'LISTENING'
  | 'TRANSCRIBING'
  | 'INTENT_CLASSIFIED'
  | 'CLARIFICATION_REQUIRED'
  | 'CONFIRMATION_REQUIRED'
  | 'READY_TO_EXECUTE'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'ERROR';

export interface Spreadsheet {
  id: string;
  googleSheetId: string;
  name: string;
  url: string;
  lastAccessedAt: string;
  createdAt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  transcript?: string;
  intent?: SheetActionIntent;
  dryRunResult?: DryRunResult;
  executed: boolean;
  executionError?: string;
  createdAt: string;
}

export interface DryRunResult {
  cells_affected: string[];
  rows_affected?: number;
  columns_affected?: string[];
  risk_level: 'low' | 'medium' | 'high';
  reversible: boolean;
  preview: string;
  warnings: string[];
  estimated_impact: {
    cells: number;
    rows?: number;
    columns?: number;
  };
}

export interface SheetActionIntent {
  action: string;
  parameters: Record<string, unknown>;
  confirmationRequired: boolean;
  clarificationNeeded?: string;
  confidence: number;
}

export interface Conversation {
  id: string;
  title: string;
  state: ConversationState;
  sheetId?: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  image?: string;
  preferredLanguage: string;
  voicePreference: string;
  defaultSheetId?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  sheetId?: string;
  sheetName?: string;
  details: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
  executionTime?: number;
  createdAt: string;
}

export interface RollbackAction {
  id: string;
  actionId: string;
  sheetId: string;
  undoAction: string;
  executed: boolean;
  expiresAt: string;
  createdAt: string;
}

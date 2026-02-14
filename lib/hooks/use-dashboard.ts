'use client';

import { useState, useCallback, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { toast } from '@/lib/hooks/use-toast';
import type {
  ConversationState,
  Spreadsheet,
  Message,
  DryRunResult,
  SheetActionIntent,
} from '@/lib/types';

interface UseDashboardReturn {
  conversationId: string | null;
  messages: Message[];
  state: ConversationState;
  selectedSheet: Spreadsheet | null;
  sheets: Spreadsheet[];
  dryRunResult: DryRunResult | null;
  isProcessing: boolean;
  isExecuting: boolean;
  showDryRunModal: boolean;
  pendingIntent: SheetActionIntent | null;
  setState: (state: ConversationState) => void;
  selectSheet: (sheet: Spreadsheet) => void;
  handleTranscript: (transcript: string, confidence: number) => Promise<void>;
  handleConfirm: () => Promise<void>;
  handleCancel: () => void;
  handleUndo: (rollbackId: string) => Promise<void>;
  loadSheets: () => Promise<void>;
}

export function useDashboard(): UseDashboardReturn {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<ConversationState>('IDLE');
  const [selectedSheet, setSelectedSheet] = useState<Spreadsheet | null>(null);
  const [sheets, setSheets] = useState<Spreadsheet[]>([]);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showDryRunModal, setShowDryRunModal] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<SheetActionIntent | null>(null);

  const loadSheets = useCallback(async () => {
    try {
      const data = await api.get<{ spreadsheets: Spreadsheet[] }>('/api/sheets/list');
      setSheets(data.spreadsheets);
      if (!selectedSheet && data.spreadsheets.length > 0) {
        setSelectedSheet(data.spreadsheets[0]);
      }
    } catch {
      // Silently fail on initial load
    }
  }, [selectedSheet]);

  useEffect(() => {
    loadSheets();
  }, [loadSheets]);

  const createConversation = useCallback(async () => {
    try {
      const data = await api.post<{ conversation: { id: string } }>(
        '/api/conversation/create',
        {
          sheetId: selectedSheet?.googleSheetId,
          title: 'Voice Session',
        }
      );
      setConversationId(data.conversation.id);
      setMessages([]);
      return data.conversation.id;
    } catch {
      toast({ title: 'Failed to start conversation', variant: 'destructive' });
      return null;
    }
  }, [selectedSheet]);

  const handleTranscript = useCallback(
    async (transcript: string, confidence: number) => {
      setIsProcessing(true);

      let convId = conversationId;
      if (!convId) {
        convId = await createConversation();
        if (!convId) {
          setIsProcessing(false);
          setState('ERROR');
          return;
        }
      }

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: transcript,
        transcript,
        executed: false,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        // Parse intent
        setState('INTENT_CLASSIFIED');
        const intentResponse = await api.post<{
          intent: SheetActionIntent;
          validation: { valid: boolean; message?: string };
        }>('/api/intent/parse', {
          transcript,
          conversationId: convId,
          sheetId: selectedSheet?.googleSheetId,
        });

        const { intent, validation } = intentResponse;

        if (!validation.valid) {
          setState('CLARIFICATION_REQUIRED');
          const assistantMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: validation.message || 'Please clarify your request.',
            intent,
            executed: false,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setIsProcessing(false);
          return;
        }

        if (intent.clarificationNeeded) {
          setState('CLARIFICATION_REQUIRED');
          const assistantMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: intent.clarificationNeeded,
            intent,
            executed: false,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setIsProcessing(false);
          return;
        }

        // Dry run
        if (selectedSheet) {
          const dryRunResponse = await api.post<{
            success: boolean;
            dryRun: DryRunResult;
            requiresConfirmation: boolean;
          }>(
            '/api/sheets/dry-run',
            {
              action: intent.action,
              parameters: intent.parameters,
              sheetId: selectedSheet.googleSheetId,
              conversationId: convId,
            }
          );

          setDryRunResult(dryRunResponse.dryRun);
          setPendingIntent(intent);

          if (
            dryRunResponse.requiresConfirmation ||
            intent.confirmationRequired
          ) {
            setState('CONFIRMATION_REQUIRED');
            setShowDryRunModal(true);
            setIsProcessing(false);
            return;
          }

          // Low risk - auto execute
          await executeIntent(intent, convId);
        } else {
          // No sheet selected, but might be creating one
          if (intent.action === 'create_spreadsheet' || intent.action === 'create_tally_sheet') {
            await executeIntent(intent, convId);
          } else {
            setState('ERROR');
            toast({
              title: 'No sheet selected',
              description: 'Please select a sheet first.',
              variant: 'destructive',
            });
          }
        }
      } catch (err) {
        setState('ERROR');
        const message = err instanceof Error ? err.message : 'Processing failed';
        toast({ title: 'Error', description: message, variant: 'destructive' });
      } finally {
        setIsProcessing(false);
      }
    },
    [conversationId, createConversation, selectedSheet]
  );

  const executeIntent = useCallback(
    async (intent: SheetActionIntent, convId: string) => {
      setIsExecuting(true);
      setState('EXECUTING');

      try {
        const result = await api.post<{
          result: unknown;
          executionTime: number;
        }>('/api/sheets/execute', {
          intent,
          sheetId: selectedSheet?.googleSheetId,
          conversationId: convId,
          confirmed: true,
        });

        setState('COMPLETED');

        const assistantMsg: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `Action completed successfully in ${result.executionTime}ms.`,
          intent,
          executed: true,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        toast({ title: 'Action completed', variant: 'success' });
        await loadSheets();

        // Reset to idle after brief delay
        setTimeout(() => setState('IDLE'), 2000);
      } catch (err) {
        setState('ERROR');
        const message = err instanceof Error ? err.message : 'Execution failed';
        const assistantMsg: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `Failed: ${message}`,
          executed: false,
          executionError: message,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        toast({ title: 'Execution failed', description: message, variant: 'destructive' });
      } finally {
        setIsExecuting(false);
        setDryRunResult(null);
        setPendingIntent(null);
        setShowDryRunModal(false);
      }
    },
    [selectedSheet, loadSheets]
  );

  const handleConfirm = useCallback(async () => {
    if (!pendingIntent || !conversationId) return;
    await executeIntent(pendingIntent, conversationId);
  }, [pendingIntent, conversationId, executeIntent]);

  const handleCancel = useCallback(() => {
    setState('IDLE');
    setDryRunResult(null);
    setPendingIntent(null);
    setShowDryRunModal(false);
  }, []);

  const handleUndo = useCallback(async (rollbackId: string) => {
    try {
      await api.post('/api/sheets/undo', { rollbackId });
      toast({ title: 'Undo successful', variant: 'success' });
      await loadSheets();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Undo failed';
      toast({ title: 'Undo failed', description: message, variant: 'destructive' });
    }
  }, [loadSheets]);

  const selectSheet = useCallback((sheet: Spreadsheet) => {
    setSelectedSheet(sheet);
  }, []);

  return {
    conversationId,
    messages,
    state,
    selectedSheet,
    sheets,
    dryRunResult,
    isProcessing,
    isExecuting,
    showDryRunModal,
    pendingIntent,
    setState,
    selectSheet,
    handleTranscript,
    handleConfirm,
    handleCancel,
    handleUndo,
    loadSheets,
  };
}

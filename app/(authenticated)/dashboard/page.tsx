'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VoiceRecorder } from '@/components/voice/voice-recorder';
import { StateIndicator } from '@/components/voice/state-indicator';
import { ConversationPanel } from '@/components/dashboard/conversation-panel';
import { DryRunModal } from '@/components/dashboard/dry-run-modal';
import { SheetSelector } from '@/components/dashboard/sheet-selector';
import { UndoPanel } from '@/components/dashboard/undo-panel';
import { useDashboard } from '@/lib/hooks/use-dashboard';
import { toast } from '@/lib/hooks/use-toast';

export default function Dashboard() {
  const {
    conversationId,
    messages,
    state,
    selectedSheet,
    sheets,
    dryRunResult,
    isProcessing,
    isExecuting,
    showDryRunModal,
    setState,
    selectSheet,
    handleTranscript,
    handleConfirm,
    handleCancel,
    handleUndo,
    loadSheets,
  } = useDashboard();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Speak naturally to manage your spreadsheets</p>
      </div>

      {/* Sheet Selector */}
      <Card>
        <CardContent className="pt-4">
          <SheetSelector
            sheets={sheets}
            selectedSheet={selectedSheet}
            onSelect={selectSheet}
            onRefresh={loadSheets}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Voice Interface */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Voice Interface</CardTitle>
                <CardDescription>Click the microphone and speak your command</CardDescription>
              </div>
              <StateIndicator state={state} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <VoiceRecorder
              conversationId={conversationId || undefined}
              onTranscript={handleTranscript}
              onStateChange={setState}
              onError={(msg) => toast({ title: 'Error', description: msg, variant: 'destructive' })}
              disabled={isProcessing || isExecuting}
            />

            {/* Example Commands */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Try these commands:</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>&bull; &quot;Create a new sheet called Sales Report&quot;</li>
                <li>&bull; &quot;Enter 45000 in cell B2&quot;</li>
                <li>&bull; &quot;Make the first row bold&quot;</li>
                <li>&bull; &quot;Add a SUM formula in B10&quot;</li>
                <li>&bull; &quot;Undo my last action&quot;</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Conversation Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
            <CardDescription>Your interaction history</CardDescription>
          </CardHeader>
          <CardContent>
            <ConversationPanel messages={messages} state={state} />
          </CardContent>
        </Card>

        {/* Undo History */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Undo History</CardTitle>
            <CardDescription>Recent actions you can undo (24-hour window)</CardDescription>
          </CardHeader>
          <CardContent>
            <UndoPanel onUndo={handleUndo} />
          </CardContent>
        </Card>
      </div>

      {/* Dry Run Confirmation Modal */}
      {dryRunResult && (
        <DryRunModal
          open={showDryRunModal}
          onOpenChange={(open) => { if (!open) handleCancel(); }}
          dryRunResult={dryRunResult}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          isExecuting={isExecuting}
        />
      )}
    </div>
  );
}

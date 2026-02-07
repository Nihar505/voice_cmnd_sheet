'use client';

import { useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoiceRecorder } from '@/lib/hooks/use-voice-recorder';
import { WaveformVisualizer } from './waveform-visualizer';
import { api } from '@/lib/api-client';
import type { ConversationState } from '@/lib/types';

interface VoiceRecorderProps {
  conversationId?: string;
  onTranscript: (transcript: string, confidence: number) => void;
  onStateChange: (state: ConversationState) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export function VoiceRecorder({
  conversationId,
  onTranscript,
  onStateChange,
  onError,
  disabled = false,
}: VoiceRecorderProps) {
  const {
    isRecording,
    isProcessing,
    audioLevel,
    analyserData,
    duration,
    error,
    startRecording,
    stopRecording,
  } = useVoiceRecorder();

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleToggle = useCallback(async () => {
    if (disabled) return;

    if (isRecording) {
      onStateChange('TRANSCRIBING');
      const blob = await stopRecording();
      if (!blob) {
        onStateChange('IDLE');
        return;
      }

      try {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });

        const response = await api.post<{
          transcript: string;
          confidence: number;
        }>('/api/voice/transcribe', {
          audio: base64,
          format: blob.type.includes('webm') ? 'webm' : 'wav',
          conversationId,
        });

        onTranscript(response.transcript, response.confidence);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transcription failed';
        onError?.(message);
        onStateChange('ERROR');
      }
    } else {
      await startRecording();
      onStateChange('LISTENING');
    }
  }, [
    disabled, isRecording, stopRecording, startRecording, conversationId,
    onTranscript, onStateChange, onError,
  ]);

  if (error) {
    onError?.(error);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Mic Button */}
      <div className="relative">
        {isRecording && (
          <span className="pulse-ring absolute inset-0 rounded-full bg-red-400" />
        )}
        <button
          onClick={handleToggle}
          disabled={disabled || isProcessing}
          className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full transition-all disabled:opacity-50 ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30'
              : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/30'
          }`}
        >
          {isProcessing ? (
            <Loader2 className="h-10 w-10 animate-spin text-white" />
          ) : isRecording ? (
            <MicOff className="h-10 w-10 text-white" />
          ) : (
            <Mic className="h-10 w-10 text-white" />
          )}
        </button>
      </div>

      {/* Audio Level Bar */}
      {isRecording && (
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-75"
            style={{ width: `${audioLevel * 100}%` }}
          />
        </div>
      )}

      {/* Waveform */}
      <WaveformVisualizer
        analyserData={analyserData}
        isRecording={isRecording}
        width={280}
        height={50}
      />

      {/* Duration / Status */}
      <p className="text-sm text-muted-foreground">
        {isProcessing
          ? 'Processing...'
          : isRecording
            ? formatDuration(duration)
            : 'Tap to start recording'}
      </p>
    </div>
  );
}

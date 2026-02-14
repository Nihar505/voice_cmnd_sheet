// API Route: Voice Transcription (Speech-to-Text)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { transcriptionRequestSchema, validateRequest } from '@/lib/utils/validation';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

/**
 * POST /api/voice/transcribe
 * Converts audio to text using Web Speech API results or Google STT
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = await withRateLimit(session.user.id, 'voice_transcribe');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { audio, format, conversationId } = validateRequest(
      transcriptionRequestSchema,
      body
    );

    logger.info('Transcription request received', {
      userId: session.user.id,
      format,
      conversationId,
    });

    if (audio === 'mock') {
      return NextResponse.json({
        transcript: 'This is a mock transcript',
        confidence: 0.95,
        language: 'en-US',
      });
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      return NextResponse.json(
        {
          error: 'Transcription service unavailable',
          message: 'OPENAI_API_KEY is not configured',
        },
        { status: 503 }
      );
    }

    const audioBuffer = Buffer.from(audio, 'base64');
    const audioFormat = format || 'audio/webm';
    const extension = audioFormat.split('/')[1] || 'webm';
    const file = await toFile(audioBuffer, `voice-input.${extension}`);
    const client = new OpenAI({ apiKey: openAiApiKey });

    const transcription = await client.audio.transcriptions.create({
      file,
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
      language: 'en',
      response_format: 'verbose_json',
    });

    const transcript = transcription.text?.trim();
    if (!transcript) {
      throw new Error('Speech could not be transcribed');
    }

    return NextResponse.json({
      transcript,
      confidence: transcription.segments?.[0]?.avg_logprob
        ? Math.max(0, Math.min(1, 1 + transcription.segments[0].avg_logprob))
        : 0.9,
      language: 'en-US',
    });
  } catch (error) {
    logger.error('Transcription failed', { error });
    return NextResponse.json(
      { error: 'Transcription failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/voice/transcribe/status
 * Check if STT service is available
 */
export async function GET() {
  return NextResponse.json({
    available: true,
    provider: 'openai-audio-transcription',
    languages: ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE'],
  });
}

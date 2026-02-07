// API Route: Intent Parsing

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { intentParseRequestSchema, validateRequest } from '@/lib/utils/validation';
import { getIntentParserService } from '@/lib/services/intent-parser.service';
import { getConversationService } from '@/lib/services/conversation.service';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * POST /api/intent/parse
 * Parse natural language transcript into structured sheet action intent
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = await withRateLimit(session.user.id, 'api_call');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { transcript, conversationId, sheetId } = validateRequest(
      intentParseRequestSchema,
      body
    );

    logger.info('Intent parsing request', {
      userId: session.user.id,
      transcript,
      conversationId,
    });

    const intentParser = getIntentParserService();
    const conversationService = getConversationService();

    // Build context from conversation history
    let context;
    if (conversationId) {
      try {
        context = await conversationService.buildContext(
          conversationId,
          session.user.id
        );
        if (sheetId) {
          context.sheetId = sheetId;
        }
      } catch (error) {
        logger.warn('Failed to build conversation context', { error });
      }
    }

    // Parse intent using OpenAI
    const intent = await intentParser.parseIntent(transcript, context);

    // Validate intent confidence
    const validation = intentParser.validateIntent(intent);

    // Save to conversation if conversationId provided
    if (conversationId) {
      await conversationService.addMessage(
        conversationId,
        'user',
        transcript,
        {
          transcript,
          intent,
          executed: false,
        }
      );
    }

    const executionTime = Date.now() - startTime;

    logger.info('Intent parsed successfully', {
      userId: session.user.id,
      action: intent.action,
      confidence: intent.confidence,
      executionTime,
    });

    return NextResponse.json({
      intent,
      validation,
      executionTime,
    });
  } catch (error) {
    logger.error('Intent parsing failed', { error });
    return NextResponse.json(
      { error: 'Intent parsing failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// API Route: Create New Conversation

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { getConversationService } from '@/lib/services/conversation.service';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * POST /api/conversation/create
 * Create a new conversation for the user
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = await withRateLimit(session.user.id, 'api_call');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { sheetId, title } = body;

    const conversationService = getConversationService();

    const conversation = await conversationService.createConversation(
      session.user.id,
      sheetId,
      title
    );

    logger.info('Conversation created', {
      userId: session.user.id,
      conversationId: conversation.id,
    });

    return NextResponse.json({ conversation });
  } catch (error) {
    logger.error('Failed to create conversation', { error });
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}

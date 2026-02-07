// API Route: Get/Delete Conversation by ID

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { getConversationService } from '@/lib/services/conversation.service';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * GET /api/conversation/[id]
 * Get conversation details with messages
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = await withRateLimit(session.user.id, 'api_call');
    if (rateLimitResponse) return rateLimitResponse;

    const conversationService = getConversationService();

    const conversation = await conversationService.getConversation(
      params.id,
      session.user.id
    );

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    logger.error('Failed to get conversation', { error });
    return NextResponse.json(
      { error: 'Failed to retrieve conversation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversation/[id]
 * Delete a conversation
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = await withRateLimit(session.user.id, 'api_call');
    if (rateLimitResponse) return rateLimitResponse;

    const conversationService = getConversationService();

    await conversationService.deleteConversation(params.id, session.user.id);

    logger.info('Conversation deleted', {
      userId: session.user.id,
      conversationId: params.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete conversation', { error });
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}

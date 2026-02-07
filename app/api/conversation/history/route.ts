// API Route: Get Conversation History

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { getConversationService } from '@/lib/services/conversation.service';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * GET /api/conversation/history?limit=20
 * Get user's conversation history
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = await withRateLimit(session.user.id, 'api_call');
    if (rateLimitResponse) return rateLimitResponse;

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const conversationService = getConversationService();

    const conversations = await conversationService.getConversationHistory(
      session.user.id,
      Math.min(limit, 100) // Max 100
    );

    return NextResponse.json({ conversations });
  } catch (error) {
    logger.error('Failed to get conversation history', { error });
    return NextResponse.json(
      { error: 'Failed to retrieve conversation history' },
      { status: 500 }
    );
  }
}

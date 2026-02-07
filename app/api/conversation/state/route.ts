// API Route: Conversation State Management

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { getConversationService } from '@/lib/services/conversation.service';
import { getStateMachineService } from '@/lib/services/state-machine.service';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * GET /api/conversation/state?conversationId=xxx
 * Get current state of a conversation
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
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing conversationId parameter' },
        { status: 400 }
      );
    }

    const conversationService = getConversationService();
    const stateMachine = getStateMachineService();

    // Get current state
    const currentState = await conversationService.getConversationState(conversationId);

    // Get state description and metadata
    const description = stateMachine.getStateDescription(currentState);
    const color = stateMachine.getStateColor(currentState);
    const nextPossibleStates = stateMachine.getNextPossibleStates(currentState);

    return NextResponse.json({
      conversationId,
      currentState,
      description,
      color,
      nextPossibleStates,
    });
  } catch (error) {
    logger.error('Failed to get conversation state', { error });
    return NextResponse.json(
      { error: 'Failed to retrieve conversation state' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/conversation/state
 * Transition conversation to a new state
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = await withRateLimit(session.user.id, 'api_call');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { conversationId, newState, reason } = body;

    if (!conversationId || !newState) {
      return NextResponse.json(
        { error: 'Missing required fields: conversationId, newState' },
        { status: 400 }
      );
    }

    const conversationService = getConversationService();

    // Transition state
    const result = await conversationService.transitionState(
      conversationId,
      newState,
      reason
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || 'Invalid state transition' },
        { status: 400 }
      );
    }

    logger.info('State transition successful', {
      userId: session.user.id,
      conversationId,
      newState,
    });

    return NextResponse.json({
      success: true,
      currentState: result.currentState,
    });
  } catch (error) {
    logger.error('Failed to transition state', { error });
    return NextResponse.json(
      { error: 'State transition failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversation/state/reset
 * Reset conversation to IDLE state
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
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing required field: conversationId' },
        { status: 400 }
      );
    }

    const conversationService = getConversationService();

    // Reset to IDLE
    await conversationService.resetState(conversationId);

    logger.info('Conversation reset to IDLE', {
      userId: session.user.id,
      conversationId,
    });

    return NextResponse.json({
      success: true,
      currentState: 'IDLE',
    });
  } catch (error) {
    logger.error('Failed to reset conversation', { error });
    return NextResponse.json(
      { error: 'Reset failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

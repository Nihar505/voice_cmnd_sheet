// API Route: Dry-Run Simulation - Step 3 of safety pipeline

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { getDryRunService } from '@/lib/services/dry-run.service';
import { getConversationService } from '@/lib/services/conversation.service';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * POST /api/sheets/dry-run
 * Simulates a sheet operation without actually executing it
 * Returns: cells_affected, risk_level, preview, reversible flag
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = await withRateLimit(session.user.id, 'sheet_operation');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { action, parameters, sheetId, conversationId } = body;

    if (!action || !parameters) {
      return NextResponse.json(
        { error: 'Missing required fields: action, parameters' },
        { status: 400 }
      );
    }

    logger.info('Dry-run simulation requested', {
      userId: session.user.id,
      action,
      sheetId,
    });

    const dryRunService = getDryRunService();

    // Perform dry-run simulation
    const result = await dryRunService.simulate(action, parameters, sheetId);

    // Update conversation state if provided
    if (conversationId) {
      const conversationService = getConversationService();

      // Store dry-run result in conversation
      const currentState = await conversationService.getConversationState(conversationId);

      // Determine next state based on dry-run result
      let nextState: any = 'READY_TO_EXECUTE';
      if (result.risk_level === 'high' || result.reversible === false) {
        nextState = 'CONFIRMATION_REQUIRED';
      }

      await conversationService.transitionState(conversationId, nextState);
    }

    logger.info('Dry-run simulation completed', {
      userId: session.user.id,
      action,
      riskLevel: result.risk_level,
      cellsAffected: result.cells_affected.length,
    });

    return NextResponse.json({
      success: true,
      dryRun: result,
      requiresConfirmation: result.risk_level === 'high' || !result.reversible,
    });
  } catch (error) {
    logger.error('Dry-run simulation failed', { error });
    return NextResponse.json(
      { error: 'Dry-run failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

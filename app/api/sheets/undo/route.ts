// API Route: Undo/Rollback Sheet Action

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { getRollbackService } from '@/lib/services/rollback.service';
import { getAuditService } from '@/lib/services/audit.service';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * POST /api/sheets/undo
 * Undoes a previous sheet action using stored rollback snapshot
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = await withRateLimit(session.user.id, 'sheet_operation');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { rollbackId } = body;

    if (!rollbackId) {
      return NextResponse.json(
        { error: 'Missing required field: rollbackId' },
        { status: 400 }
      );
    }

    logger.info('Undo action requested', {
      userId: session.user.id,
      rollbackId,
    });

    const rollbackService = getRollbackService();
    const auditService = getAuditService();

    // Execute undo
    const result = await rollbackService.executeUndo(session.user.id, rollbackId);

    const executionTime = Date.now() - startTime;

    // Log undo action
    await auditService.logAction({
      userId: session.user.id,
      action: 'undo_action',
      details: {
        rollbackId,
        result,
      },
      success: true,
      executionTime,
    });

    logger.info('Undo action completed', {
      userId: session.user.id,
      rollbackId,
      executionTime,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      executionTime,
    });
  } catch (error) {
    logger.error('Undo action failed', { error });

    // Log failure
    const session = await auth();
    if (session?.user?.id) {
      const auditService = getAuditService();
      await auditService.logAction({
        userId: session.user.id,
        action: 'undo_action',
        details: { error: (error as Error).message },
        success: false,
        errorMessage: (error as Error).message,
        executionTime: Date.now() - startTime,
      });
    }

    return NextResponse.json(
      { error: 'Undo failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sheets/undo
 * Get list of available undo actions for the user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = await withRateLimit(session.user.id, 'api_call');
    if (rateLimitResponse) return rateLimitResponse;

    const rollbackService = getRollbackService();

    // Get undo history
    const undoHistory = await rollbackService.getUndoHistory(session.user.id);

    // Get undo stats
    const stats = await rollbackService.getUndoStats(session.user.id);

    return NextResponse.json({
      undoHistory,
      stats,
    });
  } catch (error) {
    logger.error('Failed to get undo history', { error });
    return NextResponse.json(
      { error: 'Failed to retrieve undo history' },
      { status: 500 }
    );
  }
}

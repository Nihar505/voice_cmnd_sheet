// API Route: Audit Logs

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { getAuditService } from '@/lib/services/audit.service';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * GET /api/audit/logs?limit=100&offset=0&action=update_cell&sheetId=xxx
 * Get user's audit logs with optional filters
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
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action') || undefined;
    const sheetId = searchParams.get('sheetId') || undefined;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;

    const auditService = getAuditService();

    const logs = await auditService.getUserAuditLogs(session.user.id, {
      limit: Math.min(limit, 1000), // Max 1000
      offset,
      action,
      sheetId,
      startDate,
      endDate,
    });

    return NextResponse.json({ logs, count: logs.length });
  } catch (error) {
    logger.error('Failed to get audit logs', { error });
    return NextResponse.json(
      { error: 'Failed to retrieve audit logs' },
      { status: 500 }
    );
  }
}

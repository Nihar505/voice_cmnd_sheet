// API Route: Audit Statistics

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { getAuditService } from '@/lib/services/audit.service';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * GET /api/audit/stats?startDate=2024-01-01&endDate=2024-12-31
 * Get user's audit statistics
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
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;

    const auditService = getAuditService();

    const stats = await auditService.getUserAuditStats(
      session.user.id,
      startDate,
      endDate
    );

    return NextResponse.json({ stats });
  } catch (error) {
    logger.error('Failed to get audit stats', { error });
    return NextResponse.json(
      { error: 'Failed to retrieve statistics' },
      { status: 500 }
    );
  }
}

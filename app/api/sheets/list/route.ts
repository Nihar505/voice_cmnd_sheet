// API Route: List User's Spreadsheets

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import prisma from '@/lib/prisma';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * GET /api/sheets/list?limit=50
 * List user's spreadsheets
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
    const limit = parseInt(searchParams.get('limit') || '50');

    const spreadsheets = await prisma.spreadsheet.findMany({
      where: { userId: session.user.id },
      orderBy: { lastAccessedAt: 'desc' },
      take: Math.min(limit, 100),
      select: {
        id: true,
        googleSheetId: true,
        name: true,
        url: true,
        lastAccessedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ spreadsheets, count: spreadsheets.length });
  } catch (error) {
    logger.error('Failed to list spreadsheets', { error });
    return NextResponse.json(
      { error: 'Failed to retrieve spreadsheets' },
      { status: 500 }
    );
  }
}

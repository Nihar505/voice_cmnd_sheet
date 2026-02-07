// API Route: Get/Update/Delete Spreadsheet by ID

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { getAuditService } from '@/lib/services/audit.service';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

const updateSheetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
});

/**
 * GET /api/sheets/[id]
 * Get spreadsheet details with recent activity
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

    const spreadsheet = await prisma.spreadsheet.findFirst({
      where: { id: params.id, userId: session.user.id },
    });

    if (!spreadsheet) {
      return NextResponse.json(
        { error: 'Spreadsheet not found' },
        { status: 404 }
      );
    }

    const auditService = getAuditService();
    const recentActivity = await auditService.getSheetAuditLogs(
      spreadsheet.googleSheetId,
      session.user.id,
      10
    );

    return NextResponse.json({ spreadsheet, recentActivity });
  } catch (error) {
    logger.error('Failed to get spreadsheet', { error });
    return NextResponse.json(
      { error: 'Failed to retrieve spreadsheet' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sheets/[id]
 * Update spreadsheet metadata (name)
 */
export async function PUT(
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

    const body = await req.json();
    const { name } = updateSheetSchema.parse(body);

    const result = await prisma.spreadsheet.updateMany({
      where: { id: params.id, userId: session.user.id },
      data: { name },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Spreadsheet not found' },
        { status: 404 }
      );
    }

    const auditService = getAuditService();
    await auditService.logAction({
      userId: session.user.id,
      action: 'rename_sheet',
      sheetId: params.id,
      details: { newName: name },
      success: true,
    });

    const updated = await prisma.spreadsheet.findFirst({
      where: { id: params.id, userId: session.user.id },
    });

    return NextResponse.json({ spreadsheet: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', message: error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }
    logger.error('Failed to update spreadsheet', { error });
    return NextResponse.json(
      { error: 'Failed to update spreadsheet' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sheets/[id]
 * Remove spreadsheet from user's collection (does not delete from Google)
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

    const result = await prisma.spreadsheet.deleteMany({
      where: { id: params.id, userId: session.user.id },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Spreadsheet not found' },
        { status: 404 }
      );
    }

    const auditService = getAuditService();
    await auditService.logAction({
      userId: session.user.id,
      action: 'remove_sheet',
      sheetId: params.id,
      details: {},
      success: true,
    });

    logger.info('Spreadsheet removed', {
      userId: session.user.id,
      spreadsheetId: params.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete spreadsheet', { error });
    return NextResponse.json(
      { error: 'Failed to delete spreadsheet' },
      { status: 500 }
    );
  }
}

// API Route: Create New Spreadsheet

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { getGoogleSheetsService } from '@/lib/services/google-sheets.service';
import { getAuditService } from '@/lib/services/audit.service';
import prisma from '@/lib/prisma';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * POST /api/sheets/create
 * Create a new Google Spreadsheet
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
    const { title, sheetNames } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const sheetsService = await getGoogleSheetsService(session.user.id);
    const auditService = getAuditService();

    // Create spreadsheet
    const spreadsheet = await sheetsService.createSpreadsheet(title, sheetNames);

    // Save to database
    await prisma.spreadsheet.create({
      data: {
        userId: session.user.id,
        googleSheetId: spreadsheet.spreadsheetId!,
        name: title,
        url: spreadsheet.spreadsheetUrl!,
      },
    });

    // Log to audit
    await auditService.logAction({
      userId: session.user.id,
      action: 'create_spreadsheet',
      sheetId: spreadsheet.spreadsheetId,
      sheetName: title,
      details: { title, sheetNames },
      success: true,
      executionTime: Date.now() - startTime,
    });

    logger.info('Spreadsheet created', {
      userId: session.user.id,
      sheetId: spreadsheet.spreadsheetId,
    });

    return NextResponse.json({
      spreadsheet: {
        id: spreadsheet.spreadsheetId,
        url: spreadsheet.spreadsheetUrl,
        name: title,
      },
    });
  } catch (error) {
    logger.error('Failed to create spreadsheet', { error });
    return NextResponse.json(
      { error: 'Failed to create spreadsheet', message: (error as Error).message },
      { status: 500 }
    );
  }
}

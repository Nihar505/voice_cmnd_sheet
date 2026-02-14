// API Route: Execute Sheet Actions

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { executeSheetActionSchema, validateRequest } from '@/lib/utils/validation';
import { getGoogleSheetsService } from '@/lib/services/google-sheets.service';
import { getAuditService } from '@/lib/services/audit.service';
import { getConversationService } from '@/lib/services/conversation.service';
import { getRollbackService } from '@/lib/services/rollback.service';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * POST /api/sheets/execute
 * Execute a parsed sheet action intent
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let requestBody: Record<string, any> = {};

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = await withRateLimit(session.user.id, 'sheet_operation');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    requestBody = body;
    const { intent, sheetId, confirmed } = validateRequest(
      executeSheetActionSchema,
      body
    );

    logger.info('Executing sheet action', {
      userId: session.user.id,
      action: intent.action,
      sheetId,
    });

    // Check if confirmation is required
    if (intent.confirmationRequired && !confirmed) {
      return NextResponse.json({
        requiresConfirmation: true,
        message: `This action (${intent.action}) requires confirmation. Are you sure?`,
        intent,
      });
    }

    // Get services
    const sheetsService = await getGoogleSheetsService(session.user.id);
    const auditService = getAuditService();
    const rollbackService = getRollbackService();
    const conversationService = getConversationService();

    // Update conversation state to EXECUTING
    if (body.conversationId) {
      await conversationService.transitionState(
        body.conversationId,
        'EXECUTING',
        'Starting sheet operation execution'
      );
    }

    // Execute the action based on intent type
    const result = await executeAction(sheetsService, intent, sheetId);

    const executionTime = Date.now() - startTime;

    // Log to audit trail and get action ID
    const auditLog = await auditService.logAction({
      userId: session.user.id,
      action: intent.action,
      sheetId: result.sheetId,
      sheetName: result.sheetName,
      details: {
        intent,
        result,
      },
      success: true,
      executionTime,
    });

    // Create rollback snapshot for reversible actions
    if (sheetId && auditLog.id) {
      try {
        await rollbackService.createSnapshot(
          session.user.id,
          auditLog.id,
          sheetId,
          intent.action,
          intent.parameters,
          result.previousData // Will be populated by executeAction
        );
        logger.info('Rollback snapshot created', { actionId: auditLog.id });
      } catch (rollbackError) {
        logger.warn('Failed to create rollback snapshot', {
          error: rollbackError,
          action: intent.action
        });
        // Don't fail the whole operation if rollback creation fails
      }
    }

    // Update conversation state to COMPLETED
    if (body.conversationId) {
      await conversationService.transitionState(
        body.conversationId,
        'COMPLETED',
        'Sheet operation completed successfully'
      );
    }

    logger.info('Sheet action executed successfully', {
      userId: session.user.id,
      action: intent.action,
      executionTime,
    });

    return NextResponse.json({
      success: true,
      result,
      executionTime,
    });
  } catch (error) {
    logger.error('Sheet action execution failed', { error });

    // Log failure to audit trail
    const session = await auth();
    if (session?.user?.id) {
      const auditService = getAuditService();
      const conversationService = getConversationService();
      await auditService.logAction({
        userId: session.user.id,
        action: requestBody.intent?.action || 'unknown',
        sheetId: requestBody.sheetId,
        details: requestBody,
        success: false,
        errorMessage: (error as Error).message,
        executionTime: Date.now() - startTime,
      });

      // Update conversation state to ERROR
      if (requestBody.conversationId) {
        await conversationService.handleError(
          requestBody.conversationId,
          (error as Error).message
        );
      }
    }

    return NextResponse.json(
      { error: 'Action execution failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Execute action based on intent type
 */
async function executeAction(
  sheetsService: any,
  intent: any,
  sheetId?: string
): Promise<any> {
  const { action, parameters } = intent;

  switch (action) {
    case 'create_spreadsheet':
      const spreadsheet = await sheetsService.createSpreadsheet(
        parameters.title,
        parameters.sheetNames
      );
      return {
        sheetId: spreadsheet.spreadsheetId,
        sheetName: parameters.title,
        url: spreadsheet.spreadsheetUrl,
        message: `Created new spreadsheet: ${parameters.title}`,
      };

    case 'update_cell':
    case 'update_range':
      if (!sheetId) {
        throw new Error('Sheet ID is required for update operations');
      }
      const updateResult = await sheetsService.updateCells(
        sheetId,
        parameters.range,
        parameters.values,
        parameters.sheetName
      );
      return {
        sheetId,
        sheetName: parameters.sheetName,
        updatedCells: updateResult.updatedCells,
        message: `Updated ${updateResult.updatedCells} cells`,
      };

    case 'format_cells':
      if (!sheetId) {
        throw new Error('Sheet ID is required for formatting');
      }
      await sheetsService.formatCells(
        sheetId,
        parameters.range,
        parameters.format,
        parameters.sheetId || 0
      );
      return {
        sheetId,
        message: `Formatted cells in range ${parameters.range}`,
      };

    case 'insert_row':
      if (!sheetId) {
        throw new Error('Sheet ID is required for inserting rows');
      }
      await sheetsService.insertRows(
        sheetId,
        parameters.sheetId || 0,
        parameters.startIndex,
        parameters.count || 1
      );
      return {
        sheetId,
        message: `Inserted ${parameters.count || 1} row(s)`,
      };

    case 'insert_column':
      if (!sheetId) {
        throw new Error('Sheet ID is required for inserting columns');
      }
      await sheetsService.insertColumns(
        sheetId,
        parameters.sheetId || 0,
        parameters.startIndex,
        parameters.count || 1
      );
      return {
        sheetId,
        message: `Inserted ${parameters.count || 1} column(s)`,
      };

    case 'delete_row':
      if (!sheetId) {
        throw new Error('Sheet ID is required for deleting rows');
      }
      await sheetsService.deleteRows(
        sheetId,
        parameters.sheetId || 0,
        parameters.startIndex,
        parameters.count || 1
      );
      return {
        sheetId,
        message: `Deleted ${parameters.count || 1} row(s)`,
      };

    case 'freeze_rows':
      if (!sheetId) {
        throw new Error('Sheet ID is required for freezing rows');
      }
      await sheetsService.freezeRows(
        sheetId,
        parameters.sheetId || 0,
        parameters.rowCount
      );
      return {
        sheetId,
        message: `Froze ${parameters.rowCount} row(s)`,
      };

    case 'merge_cells':
      if (!sheetId) {
        throw new Error('Sheet ID is required for merging cells');
      }
      await sheetsService.mergeCells(sheetId, parameters.range, parameters.mergeType);
      return {
        sheetId,
        message: 'Cells merged successfully',
      };

    case 'sort_data':
      if (!sheetId) {
        throw new Error('Sheet ID is required for sorting');
      }
      await sheetsService.sortData(
        sheetId,
        parameters.sheetId || 0,
        parameters.range,
        parameters.columnIndex,
        parameters.ascending !== false
      );
      return {
        sheetId,
        message: 'Data sorted successfully',
      };

    case 'create_chart':
      if (!sheetId) {
        throw new Error('Sheet ID is required for creating charts');
      }
      await sheetsService.createChart(
        sheetId,
        parameters.sheetId || 0,
        parameters.chartType,
        parameters.dataRange,
        parameters.position
      );
      return {
        sheetId,
        message: `Created ${parameters.chartType} chart`,
      };


    case 'apply_formula':
      if (!sheetId) {
        throw new Error('Sheet ID is required for formulas');
      }
      await sheetsService.updateCells(
        sheetId,
        parameters.range,
        [[parameters.formula]],
        parameters.sheetName
      );
      return {
        sheetId,
        message: `Applied formula in range ${parameters.range}`,
      };

    case 'clear_range':
      if (!sheetId) {
        throw new Error('Sheet ID is required for clearing ranges');
      }
      await sheetsService.clearRange(sheetId, parameters.range, parameters.sheetName);
      return {
        sheetId,
        message: `Cleared range ${parameters.range}`,
      };

    case 'append_transaction':
      if (!sheetId) {
        throw new Error('Sheet ID is required for appending transactions');
      }
      const transactionRow = buildTransactionRow(parameters);
      await sheetsService.appendValues(
        sheetId,
        parameters.range || 'A:E',
        [transactionRow],
        parameters.sheetName
      );
      return {
        sheetId,
        message: 'Transaction appended successfully',
      };

    case 'create_tally_sheet':
      const tallySheet = await sheetsService.createSpreadsheet(
        parameters.title || 'Business Tally Sheet',
        [parameters.sheetName || 'Tally']
      );
      await sheetsService.updateCells(
        tallySheet.spreadsheetId,
        'A1:E1',
        [['Date', 'Type', 'Category', 'Description', 'Amount']],
        parameters.sheetName || 'Tally'
      );
      return {
        sheetId: tallySheet.spreadsheetId,
        sheetName: parameters.title || 'Business Tally Sheet',
        url: tallySheet.spreadsheetUrl,
        message: 'Created business tally sheet with transaction headers',
      };

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}


function buildTransactionRow(parameters: Record<string, any>): (string | number)[] {
  const tx = parameters.transaction || {};
  const date = tx.date || new Date().toISOString().split('T')[0];
  const type = tx.type || (tx.amount && Number(tx.amount) < 0 ? 'Expense' : 'Sale');
  const category = tx.category || parameters.category || 'General';
  const description = tx.description || parameters.description || 'Voice entry';
  const rawAmount = tx.amount ?? parameters.amount ?? 0;
  const amount = typeof rawAmount === 'string' ? Number(rawAmount.replace(/,/g, '')) : Number(rawAmount);

  if (!Number.isFinite(amount)) {
    throw new Error('Invalid transaction amount');
  }

  return [date, type, category, description, amount];
}

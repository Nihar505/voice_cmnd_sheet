// Rollback Service - Manages undo functionality for sheet operations

import prisma from '@/lib/prisma';
import { logger } from '@/lib/utils/logger';
import { getGoogleSheetsService } from './google-sheets.service';
import type { RollbackAction } from '@prisma/client';

export interface UndoSnapshot {
  actionId: string;
  sheetId: string;
  undoAction: string;
  undoData: Record<string, any>;
  expiresAt: Date;
}

export class RollbackService {
  private readonly ROLLBACK_WINDOW_HOURS = 24; // 24 hour undo window

  /**
   * Create a rollback snapshot before executing an action
   */
  async createSnapshot(
    userId: string,
    actionId: string,
    sheetId: string,
    action: string,
    parameters: Record<string, any>,
    currentData?: any
  ): Promise<RollbackAction> {
    try {
      const undoData = this.generateUndoData(action, parameters, currentData);
      const undoAction = this.getUndoAction(action);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.ROLLBACK_WINDOW_HOURS);

      const snapshot = await prisma.rollbackAction.create({
        data: {
          userId,
          actionId,
          sheetId,
          undoAction,
          undoData,
          expiresAt,
        },
      });

      logger.info('Rollback snapshot created', {
        snapshotId: snapshot.id,
        actionId,
        undoAction,
      });

      return snapshot;
    } catch (error) {
      logger.error('Failed to create rollback snapshot', { error, actionId });
      throw new Error('Failed to create undo snapshot');
    }
  }

  /**
   * Execute an undo operation
   */
  async executeUndo(
    userId: string,
    rollbackId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get the rollback action
      const rollback = await prisma.rollbackAction.findFirst({
        where: {
          id: rollbackId,
          userId,
          executed: false,
        },
      });

      if (!rollback) {
        throw new Error('Rollback action not found or already executed');
      }

      // Check if expired
      if (new Date() > rollback.expiresAt) {
        throw new Error(
          `Undo window expired. Actions can only be undone within ${this.ROLLBACK_WINDOW_HOURS} hours`
        );
      }

      // Execute the undo operation
      const sheetsService = await getGoogleSheetsService(userId);
      await this.performUndo(sheetsService, rollback);

      // Mark as executed
      await prisma.rollbackAction.update({
        where: { id: rollbackId },
        data: { executed: true },
      });

      logger.info('Undo executed successfully', {
        rollbackId,
        undoAction: rollback.undoAction,
      });

      return {
        success: true,
        message: `Successfully undid action: ${rollback.undoAction}`,
      };
    } catch (error) {
      logger.error('Failed to execute undo', { error, rollbackId });
      throw new Error(`Undo failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get list of available undo actions for a user
   */
  async getUndoHistory(
    userId: string,
    limit: number = 10
  ): Promise<RollbackAction[]> {
    try {
      const now = new Date();

      const actions = await prisma.rollbackAction.findMany({
        where: {
          userId,
          executed: false,
          expiresAt: {
            gt: now,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });

      return actions;
    } catch (error) {
      logger.error('Failed to get undo history', { error, userId });
      throw new Error('Failed to retrieve undo history');
    }
  }

  /**
   * Clean up expired rollback actions
   */
  async cleanupExpired(): Promise<number> {
    try {
      const now = new Date();

      const result = await prisma.rollbackAction.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      logger.info('Expired rollback actions cleaned up', {
        deletedCount: result.count,
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup expired rollback actions', { error });
      return 0;
    }
  }

  /**
   * Generate undo data based on action type
   */
  private generateUndoData(
    action: string,
    parameters: Record<string, any>,
    currentData?: any
  ): Record<string, any> {
    switch (action) {
      case 'update_cell':
      case 'update_range':
        // Store previous values
        return {
          range: parameters.range,
          previousValues: currentData?.values || [['']],
          sheetName: parameters.sheetName,
        };

      case 'format_cells':
        // Store previous formatting
        return {
          range: parameters.range,
          previousFormat: currentData?.format || {},
          sheetName: parameters.sheetName,
        };

      case 'insert_row':
        // Store inserted row indices to delete
        return {
          startIndex: parameters.startIndex,
          count: parameters.count || 1,
          sheetId: parameters.sheetId,
        };

      case 'insert_column':
        // Store inserted column indices to delete
        return {
          startIndex: parameters.startIndex,
          count: parameters.count || 1,
          sheetId: parameters.sheetId,
        };

      case 'delete_row':
        // Store deleted row data for restoration
        return {
          startIndex: parameters.startIndex,
          count: parameters.count || 1,
          deletedData: currentData?.rowData || [],
          sheetId: parameters.sheetId,
        };

      case 'delete_column':
        // Store deleted column data
        return {
          startIndex: parameters.startIndex,
          count: parameters.count || 1,
          deletedData: currentData?.columnData || [],
          sheetId: parameters.sheetId,
        };

      case 'clear_range':
        // Store cleared data
        return {
          range: parameters.range,
          clearedValues: currentData?.values || [],
          sheetName: parameters.sheetName,
        };

      case 'merge_cells':
        // Store merge info to unmerge
        return {
          range: parameters.range,
          sheetId: parameters.sheetId,
        };

      default:
        return { ...parameters };
    }
  }

  /**
   * Get the undo action for a given action
   */
  private getUndoAction(action: string): string {
    const undoMap: Record<string, string> = {
      update_cell: 'restore_cell',
      update_range: 'restore_range',
      format_cells: 'restore_format',
      insert_row: 'delete_inserted_row',
      insert_column: 'delete_inserted_column',
      delete_row: 'restore_deleted_row',
      delete_column: 'restore_deleted_column',
      clear_range: 'restore_cleared_range',
      merge_cells: 'unmerge_cells',
    };

    return undoMap[action] || 'undo_' + action;
  }

  /**
   * Perform the actual undo operation
   */
  private async performUndo(
    sheetsService: any,
    rollback: RollbackAction
  ): Promise<void> {
    const { undoAction, undoData, sheetId } = rollback;

    switch (undoAction) {
      case 'restore_cell':
      case 'restore_range':
        // Restore previous cell values
        await sheetsService.updateCells(
          sheetId,
          undoData.range,
          undoData.previousValues,
          undoData.sheetName
        );
        break;

      case 'restore_format':
        // Restore previous formatting
        await sheetsService.formatCells(
          sheetId,
          undoData.range,
          undoData.previousFormat,
          undoData.sheetId || 0
        );
        break;

      case 'delete_inserted_row':
        // Delete the rows that were inserted
        await sheetsService.deleteRows(
          sheetId,
          undoData.sheetId || 0,
          undoData.startIndex,
          undoData.count
        );
        break;

      case 'delete_inserted_column':
        // Delete the columns that were inserted
        await sheetsService.deleteRows(
          sheetId,
          undoData.sheetId || 0,
          undoData.startIndex,
          undoData.count
        );
        break;

      case 'restore_deleted_row':
        // Re-insert deleted rows
        await sheetsService.insertRows(
          sheetId,
          undoData.sheetId || 0,
          undoData.startIndex,
          undoData.count
        );
        // Restore data if available
        if (undoData.deletedData && undoData.deletedData.length > 0) {
          // Would need to implement data restoration logic
          logger.warn('Row data restoration not yet implemented');
        }
        break;

      case 'restore_cleared_range':
        // Restore cleared values
        if (undoData.clearedValues && undoData.clearedValues.length > 0) {
          await sheetsService.updateCells(
            sheetId,
            undoData.range,
            undoData.clearedValues,
            undoData.sheetName
          );
        }
        break;

      case 'unmerge_cells':
        // Unmerge cells
        // Would need to implement unmerge logic
        logger.warn('Cell unmerge not yet implemented');
        break;

      default:
        throw new Error(`Unsupported undo action: ${undoAction}`);
    }
  }

  /**
   * Get user's undo statistics
   */
  async getUndoStats(userId: string): Promise<{
    availableUndos: number;
    executedUndos: number;
    expiredUndos: number;
  }> {
    try {
      const now = new Date();

      const [available, executed, expired] = await Promise.all([
        prisma.rollbackAction.count({
          where: {
            userId,
            executed: false,
            expiresAt: { gt: now },
          },
        }),
        prisma.rollbackAction.count({
          where: {
            userId,
            executed: true,
          },
        }),
        prisma.rollbackAction.count({
          where: {
            userId,
            expiresAt: { lt: now },
          },
        }),
      ]);

      return {
        availableUndos: available,
        executedUndos: executed,
        expiredUndos: expired,
      };
    } catch (error) {
      logger.error('Failed to get undo stats', { error, userId });
      throw new Error('Failed to retrieve undo statistics');
    }
  }
}

// Singleton instance
let rollbackService: RollbackService | null = null;

export function getRollbackService(): RollbackService {
  if (!rollbackService) {
    rollbackService = new RollbackService();
  }
  return rollbackService;
}

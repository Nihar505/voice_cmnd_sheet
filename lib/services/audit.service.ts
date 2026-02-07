// Audit Service - Logs all sheet operations for security and debugging

import prisma from '@/lib/prisma';
import { logger } from '@/lib/utils/logger';
import type { AuditLog } from '@prisma/client';

export interface AuditLogEntry {
  userId: string;
  action: string;
  sheetId?: string;
  sheetName?: string;
  details: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  executionTime?: number;
}

export class AuditService {
  /**
   * Log an action to the audit trail
   */
  async logAction(entry: AuditLogEntry): Promise<AuditLog> {
    try {
      const auditLog = await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          sheetId: entry.sheetId,
          sheetName: entry.sheetName,
          details: entry.details,
          success: entry.success,
          errorMessage: entry.errorMessage,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          executionTime: entry.executionTime,
        },
      });

      logger.info('Action logged to audit trail', {
        auditLogId: auditLog.id,
        action: entry.action,
        success: entry.success,
      });

      return auditLog;
    } catch (error) {
      logger.error('Failed to log action to audit trail', { error, entry });
      // Don't throw - audit logging failure shouldn't break the main flow
      throw new Error('Failed to create audit log');
    }
  }

  /**
   * Get audit logs for a user
   */
  async getUserAuditLogs(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      action?: string;
      sheetId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<AuditLog[]> {
    try {
      const where: any = { userId };

      if (options?.action) {
        where.action = options.action;
      }

      if (options?.sheetId) {
        where.sheetId = options.sheetId;
      }

      if (options?.startDate || options?.endDate) {
        where.createdAt = {};
        if (options.startDate) {
          where.createdAt.gte = options.startDate;
        }
        if (options.endDate) {
          where.createdAt.lte = options.endDate;
        }
      }

      const auditLogs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 100,
        skip: options?.offset || 0,
      });

      return auditLogs;
    } catch (error) {
      logger.error('Failed to get user audit logs', { error, userId });
      throw new Error('Failed to retrieve audit logs');
    }
  }

  /**
   * Get audit logs for a specific sheet
   */
  async getSheetAuditLogs(
    sheetId: string,
    userId: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          sheetId,
          userId,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return auditLogs;
    } catch (error) {
      logger.error('Failed to get sheet audit logs', { error, sheetId });
      throw new Error('Failed to retrieve sheet audit logs');
    }
  }

  /**
   * Get audit statistics for a user
   */
  async getUserAuditStats(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    actionsByType: Record<string, number>;
    averageExecutionTime: number;
  }> {
    try {
      const where: any = { userId };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const logs = await prisma.auditLog.findMany({
        where,
        select: {
          success: true,
          action: true,
          executionTime: true,
        },
      });

      const totalActions = logs.length;
      const successfulActions = logs.filter((log) => log.success).length;
      const failedActions = totalActions - successfulActions;

      const actionsByType: Record<string, number> = {};
      logs.forEach((log) => {
        actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
      });

      const executionTimes = logs
        .filter((log) => log.executionTime !== null)
        .map((log) => log.executionTime as number);

      const averageExecutionTime =
        executionTimes.length > 0
          ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
          : 0;

      return {
        totalActions,
        successfulActions,
        failedActions,
        actionsByType,
        averageExecutionTime,
      };
    } catch (error) {
      logger.error('Failed to get user audit stats', { error, userId });
      throw new Error('Failed to retrieve audit statistics');
    }
  }

  /**
   * Clean up old audit logs (for GDPR compliance)
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      logger.info('Old audit logs cleaned up', {
        deletedCount: result.count,
        cutoffDate,
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup old audit logs', { error });
      throw new Error('Failed to cleanup audit logs');
    }
  }
}

// Singleton instance
let auditService: AuditService | null = null;

export function getAuditService(): AuditService {
  if (!auditService) {
    auditService = new AuditService();
  }
  return auditService;
}

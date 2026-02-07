// Rate Limiting Middleware - Prevents API abuse

import prisma from '@/lib/prisma';
import { logger } from '@/lib/utils/logger';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
};

export async function checkRateLimit(
  identifier: string,
  action: string = 'api_call',
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowMs);

    // Get or create rate limit entry
    const rateLimit = await prisma.rateLimit.findUnique({
      where: {
        identifier_action_windowStart: {
          identifier,
          action,
          windowStart,
        },
      },
    });

    if (!rateLimit) {
      // First request in this window
      await prisma.rateLimit.create({
        data: {
          identifier,
          action,
          count: 1,
          windowStart,
        },
      });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: new Date(windowStart.getTime() + config.windowMs),
      };
    }

    // Check if limit exceeded
    if (rateLimit.count >= config.maxRequests) {
      logger.warn('Rate limit exceeded', { identifier, action, count: rateLimit.count });

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(rateLimit.windowStart.getTime() + config.windowMs),
      };
    }

    // Increment counter
    await prisma.rateLimit.update({
      where: {
        id: rateLimit.id,
      },
      data: {
        count: rateLimit.count + 1,
      },
    });

    return {
      allowed: true,
      remaining: config.maxRequests - (rateLimit.count + 1),
      resetAt: new Date(rateLimit.windowStart.getTime() + config.windowMs),
    };
  } catch (error) {
    logger.error('Rate limit check failed', { error, identifier, action });
    // Fail open - allow request if rate limiting fails
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(Date.now() + config.windowMs),
    };
  }
}

/**
 * Cleanup expired rate limit entries
 * Should be run periodically (e.g., via cron job)
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await prisma.rateLimit.deleteMany({
      where: {
        windowStart: {
          lt: oneDayAgo,
        },
      },
    });

    if (result.count > 0) {
      logger.info('Cleaned up expired rate limits', { count: result.count });
    }

    return result.count;
  } catch (error) {
    logger.error('Failed to cleanup rate limits', { error });
    return 0;
  }
}

/**
 * Rate limiting configurations for different actions
 */
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  api_call: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
  },
  voice_transcribe: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // More restrictive for heavy operations
  },
  sheet_operation: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },
  auth_attempt: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // Very restrictive for security
  },
};

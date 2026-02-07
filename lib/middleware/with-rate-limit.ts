// Rate Limit Helper - Standardized rate limiting for API routes

import { NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from './rate-limiter';

type RateLimitAction = keyof typeof RATE_LIMIT_CONFIGS;

/**
 * Check rate limit for a request. Returns a 429 response if exceeded, or null if allowed.
 */
export async function withRateLimit(
  identifier: string,
  action: RateLimitAction = 'api_call'
): Promise<NextResponse | null> {
  const config = RATE_LIMIT_CONFIGS[action] || RATE_LIMIT_CONFIGS.api_call;
  const result = await checkRateLimit(identifier, action, config);

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', resetAt: result.resetAt.toISOString() },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetAt.toISOString(),
          'Retry-After': String(
            Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
          ),
        },
      }
    );
  }

  return null;
}

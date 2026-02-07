// API Route: User Preferences

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import prisma from '@/lib/prisma';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * GET /api/user/preferences
 * Get user preferences
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = await withRateLimit(session.user.id, 'api_call');
    if (rateLimitResponse) return rateLimitResponse;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        preferredLanguage: true,
        voicePreference: true,
        defaultSheetId: true,
      },
    });

    return NextResponse.json({ preferences: user });
  } catch (error) {
    logger.error('Failed to get preferences', { error });
    return NextResponse.json(
      { error: 'Failed to retrieve preferences' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/preferences
 * Update user preferences
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = await withRateLimit(session.user.id, 'api_call');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { preferredLanguage, voicePreference, defaultSheetId } = body;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(preferredLanguage && { preferredLanguage }),
        ...(voicePreference && { voicePreference }),
        ...(defaultSheetId !== undefined && { defaultSheetId }),
      },
      select: {
        preferredLanguage: true,
        voicePreference: true,
        defaultSheetId: true,
      },
    });

    logger.info('User preferences updated', { userId: session.user.id });

    return NextResponse.json({ preferences: user });
  } catch (error) {
    logger.error('Failed to update preferences', { error });
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

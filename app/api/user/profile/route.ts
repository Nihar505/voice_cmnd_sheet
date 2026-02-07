// API Route: User Profile Management

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import prisma from '@/lib/prisma';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * GET /api/user/profile
 * Get current user's profile
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
        id: true,
        email: true,
        name: true,
        image: true,
        preferredLanguage: true,
        voicePreference: true,
        defaultSheetId: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    logger.error('Failed to get user profile', { error });
    return NextResponse.json(
      { error: 'Failed to retrieve profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/profile
 * Update user profile
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
    const { name, image } = body;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name && { name }),
        ...(image && { image }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        preferredLanguage: true,
        voicePreference: true,
        createdAt: true,
      },
    });

    logger.info('User profile updated', { userId: session.user.id });

    return NextResponse.json({ user });
  } catch (error) {
    logger.error('Failed to update user profile', { error });
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

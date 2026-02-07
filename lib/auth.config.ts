// NextAuth.js v5 Configuration

import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/utils/encryption';

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request offline access to get refresh token
          access_type: 'offline',
          prompt: 'consent',
          // Request Google Sheets and Drive scopes
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file',
          ].join(' '),
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' && account.access_token) {
        try {
          // Store encrypted Google OAuth tokens
          const expiresAt = account.expires_at
            ? new Date(account.expires_at * 1000)
            : new Date(Date.now() + 3600 * 1000);

          await prisma.googleToken.upsert({
            where: { userId: user.id as string },
            create: {
              userId: user.id as string,
              accessToken: encrypt(account.access_token),
              refreshToken: account.refresh_token ? encrypt(account.refresh_token) : null,
              expiresAt,
              scope: account.scope || '',
            },
            update: {
              accessToken: encrypt(account.access_token),
              refreshToken: account.refresh_token ? encrypt(account.refresh_token) : null,
              expiresAt,
              scope: account.scope || '',
            },
          });
        } catch (error) {
          console.error('Failed to store Google tokens:', error);
          return false;
        }
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  debug: process.env.NODE_ENV === 'development',
};

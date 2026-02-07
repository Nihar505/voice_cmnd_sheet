// Middleware for route protection and authentication

import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Public routes
  const publicRoutes = [
    '/auth/signin',
    '/auth/signup',
    '/auth/error',
    '/api/auth',
    '/api/health',
  ];

  const isPublicRoute =
    pathname === '/' ||
    publicRoutes.some((route) => pathname.startsWith(route));

  // Redirect to signin if not authenticated and accessing protected route
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL('/auth/signin', req.url));
  }

  // Redirect to dashboard if authenticated and accessing auth pages
  if (isLoggedIn && pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};

'use client';

import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: 'Could not start the sign-in process. Please try again.',
  OAuthCallback: 'There was an issue with the authentication callback.',
  OAuthCreateAccount: 'Could not create your account. Please try again.',
  OAuthAccountNotLinked: 'This email is already linked to another account. Sign in with the original provider.',
  Callback: 'Authentication callback failed. Please try again.',
  Default: 'An unexpected authentication error occurred.',
};

export default function AuthError() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'Default';
  const message = ERROR_MESSAGES[error] || ERROR_MESSAGES.Default;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-destructive">Authentication Error</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Link href="/auth/signin" className="block">
            <Button className="w-full" size="lg">
              Try Again
            </Button>
          </Link>
          <Link href="/" className="block">
            <Button variant="outline" className="w-full">
              Back to Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

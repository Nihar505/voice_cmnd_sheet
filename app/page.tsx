// Landing Page

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="flex flex-1 items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-20">
        <div className="max-w-4xl text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-gray-900">
            Voice-Driven Google Sheets
          </h1>
          <p className="mb-8 text-xl text-gray-600">
            Create, edit, and manage spreadsheets entirely with your voice.
            No typing required.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/auth/signin">
              <Button size="lg" className="text-lg">
                Get Started
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="text-lg">
                Try Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold">
            Production-Ready Features
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>🎤 Voice-First</CardTitle>
                <CardDescription>
                  Speak naturally to create and manage spreadsheets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Powered by OpenAI GPT-4 for superior intent understanding
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🛡️ Safety First</CardTitle>
                <CardDescription>
                  Dry-run simulation before every action
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Preview changes before execution. No surprises.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>↩️ 24-Hour Undo</CardTitle>
                <CardDescription>
                  Complete rollback capability
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Undo any action within 24 hours with full data restoration
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🔄 State Machine</CardTitle>
                <CardDescription>
                  Always know what's happening
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Clear visual feedback at each processing step
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🔐 Secure</CardTitle>
                <CardDescription>
                  Multi-user with data isolation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Encrypted OAuth tokens, complete audit trail
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>📊 Audit Trail</CardTitle>
                <CardDescription>
                  Every action logged
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Full compliance-ready action history
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 px-4 py-8">
        <div className="mx-auto max-w-6xl text-center text-sm text-gray-600">
          <p>© 2026 Voice Sheets Assistant. Production-ready with safety built-in.</p>
          <p className="mt-2">Built with Next.js, Prisma, OpenAI GPT-4, and Google Sheets API</p>
        </div>
      </footer>
    </div>
  );
}

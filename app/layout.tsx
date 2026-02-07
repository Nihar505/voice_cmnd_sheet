// Root Layout - Providers and Global Styles

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/components/providers/session-provider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Voice Sheets Assistant',
  description: 'Voice-driven Google Sheets management assistant',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}

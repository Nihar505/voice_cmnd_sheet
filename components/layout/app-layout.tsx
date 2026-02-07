'use client';

import { useState } from 'react';
import { AppHeader } from './app-header';
import { Sidebar } from './sidebar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

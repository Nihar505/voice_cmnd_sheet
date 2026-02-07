'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { Mic, Settings, FileSpreadsheet, MessageSquare, LogOut, Menu } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppHeaderProps {
  onToggleSidebar?: () => void;
}

export function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  const { data: session } = useSession();
  const user = session?.user;
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase()
    : '?';

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onToggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <Mic className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">Voice Sheets</span>
        </Link>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.image || ''} alt={user?.name || ''} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <Link href="/sheets">
              <DropdownMenuItem>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                My Sheets
              </DropdownMenuItem>
            </Link>
            <Link href="/conversations">
              <DropdownMenuItem>
                <MessageSquare className="mr-2 h-4 w-4" />
                Conversations
              </DropdownMenuItem>
            </Link>
            <Link href="/settings">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/' })}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Message, ConversationState } from '@/lib/types';

interface ConversationPanelProps {
  messages: Message[];
  state: ConversationState;
}

export function ConversationPanel({ messages, state }: ConversationPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center text-muted-foreground">
        <MessageSquare className="mb-3 h-10 w-10 opacity-50" />
        <p className="text-sm font-medium">No messages yet</p>
        <p className="mt-1 text-xs">Start a voice command to begin</p>
      </div>
    );
  }

  return (
    <div className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}
          >
            <p>{msg.content}</p>
            <div className="mt-1 flex items-center gap-2">
              {msg.intent && (
                <Badge variant="secondary" className="text-[10px]">
                  {msg.intent.action}
                </Badge>
              )}
              {msg.executed && (
                <Badge variant="outline" className="text-[10px] border-green-300 text-green-700">
                  executed
                </Badge>
              )}
              {msg.executionError && (
                <Badge variant="destructive" className="text-[10px]">
                  failed
                </Badge>
              )}
              <span className="text-[10px] opacity-60">
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// Conversation Service - Manages conversation context and history

import prisma from '@/lib/prisma';
import { logger } from '@/lib/utils/logger';
import { getStateMachineService } from './state-machine.service';
import type { Conversation, Message, ConversationState } from '@prisma/client';

export interface ConversationContext {
  conversationId: string;
  sheetId?: string;
  sheetName?: string;
  lastAction?: string;
  previousMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export class ConversationService {
  /**
   * Create a new conversation
   */
  async createConversation(
    userId: string,
    sheetId?: string,
    title?: string
  ): Promise<Conversation> {
    try {
      const conversation = await prisma.conversation.create({
        data: {
          userId,
          sheetId,
          title: title || 'New Conversation',
        },
      });

      logger.info('Conversation created', {
        conversationId: conversation.id,
        userId,
      });

      return conversation;
    } catch (error) {
      logger.error('Failed to create conversation', { error, userId });
      throw new Error('Failed to create conversation');
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string, userId: string): Promise<Conversation | null> {
    try {
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 50, // Limit to last 50 messages
          },
        },
      });

      return conversation;
    } catch (error) {
      logger.error('Failed to get conversation', { error, conversationId });
      throw new Error('Failed to retrieve conversation');
    }
  }

  /**
   * Get user's active conversation
   */
  async getActiveConversation(userId: string): Promise<Conversation | null> {
    try {
      const conversation = await prisma.conversation.findFirst({
        where: {
          userId,
          endedAt: null,
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 50,
          },
        },
      });

      return conversation;
    } catch (error) {
      logger.error('Failed to get active conversation', { error, userId });
      throw new Error('Failed to retrieve active conversation');
    }
  }

  /**
   * Add message to conversation
   */
  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: {
      transcript?: string;
      intent?: any;
      executed?: boolean;
      executionError?: string;
    }
  ): Promise<Message> {
    try {
      const message = await prisma.message.create({
        data: {
          conversationId,
          role,
          content,
          transcript: metadata?.transcript,
          intent: metadata?.intent,
          executed: metadata?.executed,
          executionError: metadata?.executionError,
        },
      });

      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      logger.info('Message added to conversation', {
        conversationId,
        messageId: message.id,
        role,
      });

      return message;
    } catch (error) {
      logger.error('Failed to add message', { error, conversationId });
      throw new Error('Failed to add message to conversation');
    }
  }

  /**
   * Build conversation context for intent parsing
   */
  async buildContext(conversationId: string, userId: string): Promise<ConversationContext> {
    try {
      const conversation = await this.getConversation(conversationId, userId);

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const messages = (conversation as any).messages || [];
      const previousMessages = messages.map((msg: Message) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      // Find last executed action
      const lastExecuted = messages
        .filter((msg: Message) => msg.executed && msg.intent)
        .pop();

      return {
        conversationId,
        sheetId: conversation.sheetId || undefined,
        lastAction: lastExecuted?.intent?.action,
        previousMessages,
      };
    } catch (error) {
      logger.error('Failed to build context', { error, conversationId });
      throw new Error('Failed to build conversation context');
    }
  }

  /**
   * End conversation
   */
  async endConversation(conversationId: string, userId: string): Promise<void> {
    try {
      await prisma.conversation.updateMany({
        where: {
          id: conversationId,
          userId,
        },
        data: {
          endedAt: new Date(),
        },
      });

      logger.info('Conversation ended', { conversationId });
    } catch (error) {
      logger.error('Failed to end conversation', { error, conversationId });
      throw new Error('Failed to end conversation');
    }
  }

  /**
   * Get conversation history for a user
   */
  async getConversationHistory(
    userId: string,
    limit: number = 20
  ): Promise<Conversation[]> {
    try {
      const conversations = await prisma.conversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1, // Just get the last message for preview
          },
        },
      });

      return conversations;
    } catch (error) {
      logger.error('Failed to get conversation history', { error, userId });
      throw new Error('Failed to retrieve conversation history');
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    try {
      await prisma.conversation.deleteMany({
        where: {
          id: conversationId,
          userId,
        },
      });

      logger.info('Conversation deleted', { conversationId });
    } catch (error) {
      logger.error('Failed to delete conversation', { error, conversationId });
      throw new Error('Failed to delete conversation');
    }
  }

  /**
   * Update conversation sheet reference
   */
  async updateConversationSheet(
    conversationId: string,
    sheetId: string,
    userId: string
  ): Promise<void> {
    try {
      await prisma.conversation.updateMany({
        where: {
          id: conversationId,
          userId,
        },
        data: { sheetId },
      });

      logger.info('Conversation sheet updated', { conversationId, sheetId });
    } catch (error) {
      logger.error('Failed to update conversation sheet', {
        error,
        conversationId,
      });
      throw new Error('Failed to update conversation sheet');
    }
  }

  /**
   * Transition conversation state
   */
  async transitionState(
    conversationId: string,
    newState: ConversationState,
    reason?: string
  ): Promise<{ success: boolean; currentState: ConversationState; message?: string }> {
    const stateMachine = getStateMachineService();
    return stateMachine.transitionState(conversationId, newState, reason);
  }

  /**
   * Get current conversation state
   */
  async getConversationState(conversationId: string): Promise<ConversationState> {
    const stateMachine = getStateMachineService();
    return stateMachine.getCurrentState(conversationId);
  }

  /**
   * Reset conversation to IDLE state
   */
  async resetState(conversationId: string): Promise<void> {
    const stateMachine = getStateMachineService();
    await stateMachine.resetToIdle(conversationId);
  }

  /**
   * Handle error and transition to ERROR state
   */
  async handleError(
    conversationId: string,
    errorMessage: string
  ): Promise<void> {
    const stateMachine = getStateMachineService();
    const currentState = await stateMachine.getCurrentState(conversationId);
    await stateMachine.handleError(conversationId, errorMessage, currentState);
  }

  /**
   * Check if state transition is valid
   */
  isValidTransition(
    fromState: ConversationState,
    toState: ConversationState
  ): boolean {
    const stateMachine = getStateMachineService();
    return stateMachine.isValidTransition(fromState, toState);
  }

  /**
   * Get state description for UI
   */
  getStateDescription(state: ConversationState): string {
    const stateMachine = getStateMachineService();
    return stateMachine.getStateDescription(state);
  }
}

// Singleton instance
let conversationService: ConversationService | null = null;

export function getConversationService(): ConversationService {
  if (!conversationService) {
    conversationService = new ConversationService();
  }
  return conversationService;
}

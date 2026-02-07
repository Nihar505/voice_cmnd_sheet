// State Machine Service - Manages conversation state transitions

import prisma from '@/lib/prisma';
import { logger } from '@/lib/utils/logger';
import type { ConversationState } from '@prisma/client';

// Valid state transitions
const VALID_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  IDLE: ['LISTENING'],
  LISTENING: ['TRANSCRIBING', 'IDLE', 'ERROR'],
  TRANSCRIBING: ['INTENT_CLASSIFIED', 'ERROR'],
  INTENT_CLASSIFIED: [
    'CLARIFICATION_REQUIRED',
    'CONFIRMATION_REQUIRED',
    'READY_TO_EXECUTE',
    'ERROR',
  ],
  CLARIFICATION_REQUIRED: ['LISTENING', 'IDLE'],
  CONFIRMATION_REQUIRED: ['READY_TO_EXECUTE', 'IDLE', 'ERROR'],
  READY_TO_EXECUTE: ['EXECUTING', 'ERROR'],
  EXECUTING: ['COMPLETED', 'ERROR'],
  COMPLETED: ['IDLE'],
  ERROR: ['IDLE', 'LISTENING'],
};

export interface StateTransition {
  from: ConversationState;
  to: ConversationState;
  timestamp: Date;
  reason?: string;
}

export class StateMachineService {
  /**
   * Transition conversation to a new state
   */
  async transitionState(
    conversationId: string,
    newState: ConversationState,
    reason?: string
  ): Promise<{success: boolean; currentState: ConversationState; message?: string}> {
    try {
      // Get current state
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { state: true },
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const currentState = conversation.state;

      // Validate transition
      const isValid = this.isValidTransition(currentState, newState);

      if (!isValid) {
        logger.warn('Invalid state transition attempted', {
          conversationId,
          from: currentState,
          to: newState,
        });

        return {
          success: false,
          currentState,
          message: `Invalid state transition from ${currentState} to ${newState}`,
        };
      }

      // Perform transition
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { state: newState },
      });

      logger.info('State transition successful', {
        conversationId,
        from: currentState,
        to: newState,
        reason,
      });

      return {
        success: true,
        currentState: newState,
      };
    } catch (error) {
      logger.error('State transition failed', { error, conversationId, newState });
      throw new Error('Failed to transition state');
    }
  }

  /**
   * Check if a state transition is valid
   */
  isValidTransition(
    fromState: ConversationState,
    toState: ConversationState
  ): boolean {
    const allowedTransitions = VALID_TRANSITIONS[fromState] || [];
    return allowedTransitions.includes(toState);
  }

  /**
   * Get current state of a conversation
   */
  async getCurrentState(conversationId: string): Promise<ConversationState> {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { state: true },
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      return conversation.state;
    } catch (error) {
      logger.error('Failed to get current state', { error, conversationId });
      throw new Error('Failed to retrieve conversation state');
    }
  }

  /**
   * Reset conversation to IDLE state
   */
  async resetToIdle(conversationId: string): Promise<void> {
    try {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { state: 'IDLE' },
      });

      logger.info('Conversation reset to IDLE', { conversationId });
    } catch (error) {
      logger.error('Failed to reset conversation', { error, conversationId });
      throw new Error('Failed to reset conversation state');
    }
  }

  /**
   * Handle error state transition
   */
  async handleError(
    conversationId: string,
    errorMessage: string,
    currentState?: ConversationState
  ): Promise<void> {
    try {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { state: 'ERROR' },
      });

      logger.info('Conversation transitioned to ERROR state', {
        conversationId,
        errorMessage,
        previousState: currentState,
      });
    } catch (error) {
      logger.error('Failed to handle error state', { error, conversationId });
    }
  }

  /**
   * Get state description for UI display
   */
  getStateDescription(state: ConversationState): string {
    const descriptions: Record<ConversationState, string> = {
      IDLE: 'Ready to listen',
      LISTENING: 'Listening to your voice...',
      TRANSCRIBING: 'Converting speech to text...',
      INTENT_CLASSIFIED: 'Understanding your request...',
      CLARIFICATION_REQUIRED: 'Need more information',
      CONFIRMATION_REQUIRED: 'Waiting for your confirmation',
      READY_TO_EXECUTE: 'Ready to execute',
      EXECUTING: 'Performing action...',
      COMPLETED: 'Action completed',
      ERROR: 'An error occurred',
    };

    return descriptions[state] || 'Unknown state';
  }

  /**
   * Get next possible states from current state
   */
  getNextPossibleStates(currentState: ConversationState): ConversationState[] {
    return VALID_TRANSITIONS[currentState] || [];
  }

  /**
   * Get state color for UI indicators
   */
  getStateColor(state: ConversationState): string {
    const colors: Record<ConversationState, string> = {
      IDLE: 'gray',
      LISTENING: 'blue',
      TRANSCRIBING: 'blue',
      INTENT_CLASSIFIED: 'purple',
      CLARIFICATION_REQUIRED: 'yellow',
      CONFIRMATION_REQUIRED: 'orange',
      READY_TO_EXECUTE: 'green',
      EXECUTING: 'blue',
      COMPLETED: 'green',
      ERROR: 'red',
    };

    return colors[state] || 'gray';
  }

  /**
   * Check if conversation can be reset (not currently executing)
   */
  async canReset(conversationId: string): Promise<boolean> {
    const currentState = await this.getCurrentState(conversationId);
    return currentState !== 'EXECUTING';
  }

  /**
   * Get state statistics for a user
   */
  async getStateStats(userId: string): Promise<Record<ConversationState, number>> {
    try {
      const conversations = await prisma.conversation.findMany({
        where: { userId },
        select: { state: true },
      });

      const stats: Record<string, number> = {};

      conversations.forEach((conv) => {
        stats[conv.state] = (stats[conv.state] || 0) + 1;
      });

      return stats as Record<ConversationState, number>;
    } catch (error) {
      logger.error('Failed to get state statistics', { error, userId });
      throw new Error('Failed to retrieve state statistics');
    }
  }

  /**
   * Force transition (bypass validation) - use with caution
   */
  async forceTransition(
    conversationId: string,
    newState: ConversationState,
    reason: string
  ): Promise<void> {
    try {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { state: newState },
      });

      logger.warn('Forced state transition', {
        conversationId,
        newState,
        reason,
      });
    } catch (error) {
      logger.error('Failed to force state transition', { error, conversationId });
      throw new Error('Failed to force state transition');
    }
  }

  /**
   * Cleanup stuck conversations (in non-terminal states for too long)
   */
  async cleanupStuckConversations(maxAgeMinutes: number = 30): Promise<number> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - maxAgeMinutes);

      const result = await prisma.conversation.updateMany({
        where: {
          state: {
            notIn: ['IDLE', 'COMPLETED'],
          },
          updatedAt: {
            lt: cutoffTime,
          },
        },
        data: {
          state: 'ERROR',
        },
      });

      if (result.count > 0) {
        logger.info('Cleaned up stuck conversations', {
          count: result.count,
          maxAgeMinutes,
        });
      }

      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup stuck conversations', { error });
      return 0;
    }
  }
}

// Singleton instance
let stateMachineService: StateMachineService | null = null;

export function getStateMachineService(): StateMachineService {
  if (!stateMachineService) {
    stateMachineService = new StateMachineService();
  }
  return stateMachineService;
}

// Intent Parser Service - Uses OpenAI GPT-4 to parse natural language into structured sheet actions

import OpenAI from 'openai';
import { logger } from '@/lib/utils/logger';
import { sheetActionIntentSchema } from '@/lib/utils/validation';
import type { z } from 'zod';

export type SheetActionIntent = z.infer<typeof sheetActionIntentSchema>;

interface ConversationContext {
  previousMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentSheetId?: string;
  currentSheetName?: string;
  lastAction?: string;
}

export class IntentParserService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Parse natural language into structured sheet action intent
   */
  async parseIntent(
    transcript: string,
    context?: ConversationContext
  ): Promise<SheetActionIntent> {
    try {
      logger.info('Parsing intent', { transcript, context });

      const systemPrompt = this.buildSystemPrompt(context);
      const userPrompt = this.buildUserPrompt(transcript, context);

      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for more deterministic outputs
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const intent = sheetActionIntentSchema.parse(parsed);

      logger.info('Intent parsed successfully', { intent });
      return intent;
    } catch (error) {
      logger.error('Intent parsing failed', { error, transcript });
      throw new Error(`Failed to parse intent: ${(error as Error).message}`);
    }
  }

  /**
   * Build system prompt with context awareness
   */
  private buildSystemPrompt(context?: ConversationContext): string {
    return `You are an AI assistant that converts natural language commands into structured Google Sheets operations.

Your task is to analyze user voice commands and output a JSON object with the following structure:
{
  "action": "<action_type>",
  "parameters": { <action_specific_parameters> },
  "confirmationRequired": <boolean>,
  "clarificationNeeded": "<optional_string>",
  "confidence": <number_between_0_and_1>
}

Available actions:
- create_spreadsheet: Create a new spreadsheet
- open_spreadsheet: Open an existing spreadsheet
- update_cell: Update a single cell or range
- update_range: Update multiple cells
- insert_row: Insert a new row
- insert_column: Insert a new column
- delete_row: Delete a row
- delete_column: Delete a column
- format_cells: Apply formatting (bold, color, alignment, etc.)
- apply_formula: Apply Excel/Sheets formulas
- sort_data: Sort data by column
- filter_data: Apply filters
- create_chart: Create charts/graphs
- rename_sheet: Rename a sheet tab
- merge_cells: Merge cell ranges
- freeze_rows: Freeze header rows
- freeze_columns: Freeze columns
- add_data_validation: Add dropdown/validation rules
- clear_range: Clear cell contents

Parameter guidelines:
- For ranges, use A1 notation (e.g., "A1", "A1:B10")
- For dates, use ISO format (YYYY-MM-DD)
- For currency, specify the value as a number
- Infer sheet structure intelligently (headers, data types, etc.)
- If the command refers to "current sheet" or "this sheet", use the context

Set confirmationRequired=true for destructive actions (delete, clear).
Set clarificationNeeded if the command is ambiguous.
Set confidence based on how clear the intent is (0.0 to 1.0).

${context ? this.buildContextPrompt(context) : ''}

Always respond with valid JSON only, no additional text.`;
  }

  /**
   * Build context-aware prompt
   */
  private buildContextPrompt(context: ConversationContext): string {
    let prompt = '\n\nCurrent Context:\n';

    if (context.currentSheetId) {
      prompt += `- Current sheet ID: ${context.currentSheetId}\n`;
    }
    if (context.currentSheetName) {
      prompt += `- Current sheet name: ${context.currentSheetName}\n`;
    }
    if (context.lastAction) {
      prompt += `- Last action performed: ${context.lastAction}\n`;
    }

    if (context.previousMessages.length > 0) {
      prompt += '\nRecent conversation:\n';
      context.previousMessages.slice(-3).forEach((msg) => {
        prompt += `${msg.role}: ${msg.content}\n`;
      });
    }

    return prompt;
  }

  /**
   * Build user prompt with examples
   */
  private buildUserPrompt(transcript: string, context?: ConversationContext): string {
    let prompt = `Parse this voice command into a structured action:\n\n"${transcript}"\n\n`;

    // Add contextual hints
    if (context?.currentSheetId) {
      prompt += `Note: User is currently working on sheet "${context.currentSheetName || 'Untitled'}"\n`;
    }

    prompt += 'Examples:\n\n';
    prompt += '1. "Create a new sheet called Sales Report"\n';
    prompt += JSON.stringify({
      action: 'create_spreadsheet',
      parameters: { title: 'Sales Report' },
      confirmationRequired: false,
      confidence: 0.95,
    }) + '\n\n';

    prompt += '2. "Enter 45000 in cell B2"\n';
    prompt += JSON.stringify({
      action: 'update_cell',
      parameters: {
        range: 'B2',
        values: [[45000]],
        inferFormat: true,
      },
      confirmationRequired: false,
      confidence: 0.98,
    }) + '\n\n';

    prompt += '3. "Make the first row bold"\n';
    prompt += JSON.stringify({
      action: 'format_cells',
      parameters: {
        range: '1:1',
        format: { bold: true },
      },
      confirmationRequired: false,
      confidence: 0.95,
    }) + '\n\n';

    prompt += 'Now parse the user command above.';
    return prompt;
  }

  /**
   * Validate intent confidence and check for clarification
   */
  validateIntent(intent: SheetActionIntent): {
    valid: boolean;
    message?: string;
  } {
    if (intent.confidence < 0.6) {
      return {
        valid: false,
        message: intent.clarificationNeeded || 'I\'m not confident I understood correctly. Could you rephrase that?',
      };
    }

    if (intent.clarificationNeeded) {
      return {
        valid: false,
        message: intent.clarificationNeeded,
      };
    }

    return { valid: true };
  }
}

// Singleton instance
let intentParserService: IntentParserService | null = null;

export function getIntentParserService(): IntentParserService {
  if (!intentParserService) {
    intentParserService = new IntentParserService();
  }
  return intentParserService;
}

// Validation schemas using Zod

import { z } from 'zod';

// Voice transcription request
export const transcriptionRequestSchema = z.object({
  audio: z.string().min(1, 'Audio data is required'),
  format: z.enum(['audio/webm', 'audio/wav', 'audio/mp3']).default('audio/webm'),
  conversationId: z.string().optional(),
});

// Intent parsing request
export const intentParseRequestSchema = z.object({
  transcript: z.string().min(1, 'Transcript is required'),
  conversationId: z.string().optional(),
  sheetId: z.string().optional(),
});

// Sheet action intent schema
export const sheetActionIntentSchema = z.object({
  action: z.enum([
    'create_spreadsheet',
    'open_spreadsheet',
    'update_cell',
    'update_range',
    'insert_row',
    'insert_column',
    'delete_row',
    'delete_column',
    'format_cells',
    'apply_formula',
    'sort_data',
    'filter_data',
    'create_chart',
    'rename_sheet',
    'merge_cells',
    'freeze_rows',
    'freeze_columns',
    'add_data_validation',
    'clear_range',
    'append_transaction',
    'create_tally_sheet',
  ]),
  parameters: z.record(z.any()),
  confirmationRequired: z.boolean().default(false),
  clarificationNeeded: z.string().optional(),
  confidence: z.number().min(0).max(1).default(1),
});

// Execute sheet action request
export const executeSheetActionSchema = z.object({
  intent: sheetActionIntentSchema,
  sheetId: z.string().optional(),
  confirmed: z.boolean().default(false),
});

// Create spreadsheet parameters
export const createSpreadsheetSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  sheetNames: z.array(z.string()).optional(),
});

// Update cell parameters
export const updateCellSchema = z.object({
  sheetId: z.string().min(1, 'Sheet ID is required'),
  range: z.string().min(1, 'Range is required'),
  values: z.array(z.array(z.any())),
  sheetName: z.string().optional(),
});

// Format cells parameters
export const formatCellsSchema = z.object({
  sheetId: z.string().min(1, 'Sheet ID is required'),
  range: z.string().min(1, 'Range is required'),
  format: z.object({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    fontSize: z.number().optional(),
    fontFamily: z.string().optional(),
    textColor: z.object({
      red: z.number().min(0).max(1),
      green: z.number().min(0).max(1),
      blue: z.number().min(0).max(1),
    }).optional(),
    backgroundColor: z.object({
      red: z.number().min(0).max(1),
      green: z.number().min(0).max(1),
      blue: z.number().min(0).max(1),
    }).optional(),
    horizontalAlignment: z.enum(['LEFT', 'CENTER', 'RIGHT']).optional(),
    verticalAlignment: z.enum(['TOP', 'MIDDLE', 'BOTTOM']).optional(),
    numberFormat: z.string().optional(),
  }),
  sheetName: z.string().optional(),
});

// User registration
export const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// User preferences
export const userPreferencesSchema = z.object({
  preferredLanguage: z.string().default('en-US'),
  voicePreference: z.string().default('default'),
  defaultSheetId: z.string().optional(),
});

// Validate request with schema
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Validation error: ${messages.join(', ')}`);
    }
    throw error;
  }
}

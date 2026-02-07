// Google Sheets Service - Handles all Sheets API operations

import { google, sheets_v4 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '@/lib/utils/logger';
import { decrypt } from '@/lib/utils/encryption';
import prisma from '@/lib/prisma';

type Sheets = sheets_v4.Sheets;

interface SheetOperation {
  sheetId: string;
  operation: string;
  details: Record<string, any>;
}

export class GoogleSheetsService {
  private sheets: Sheets;
  private oauth2Client: OAuth2Client;

  constructor(accessToken: string, refreshToken?: string) {
    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    );

    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Initialize Sheets API
    this.sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
  }

  /**
   * Create a new spreadsheet
   */
  async createSpreadsheet(title: string, sheetNames?: string[]): Promise<sheets_v4.Schema$Spreadsheet> {
    try {
      logger.info('Creating spreadsheet', { title, sheetNames });

      const sheets = sheetNames?.map((name) => ({ properties: { title: name } }));

      const response = await this.sheets.spreadsheets.create({
        requestBody: {
          properties: { title },
          sheets,
        },
      });

      logger.info('Spreadsheet created', { spreadsheetId: response.data.spreadsheetId });
      return response.data;
    } catch (error) {
      logger.error('Failed to create spreadsheet', { error, title });
      throw this.handleError(error);
    }
  }

  /**
   * Get spreadsheet metadata
   */
  async getSpreadsheet(spreadsheetId: string): Promise<sheets_v4.Schema$Spreadsheet> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get spreadsheet', { error, spreadsheetId });
      throw this.handleError(error);
    }
  }

  /**
   * Update cell values
   */
  async updateCells(
    spreadsheetId: string,
    range: string,
    values: any[][],
    sheetName?: string
  ): Promise<sheets_v4.Schema$UpdateValuesResponse> {
    try {
      const fullRange = sheetName ? `${sheetName}!${range}` : range;

      logger.info('Updating cells', { spreadsheetId, range: fullRange, valueCount: values.length });

      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: fullRange,
        valueInputOption: 'USER_ENTERED', // Parse formulas, dates, numbers
        requestBody: {
          values,
        },
      });

      logger.info('Cells updated', { updatedCells: response.data.updatedCells });
      return response.data;
    } catch (error) {
      logger.error('Failed to update cells', { error, spreadsheetId, range });
      throw this.handleError(error);
    }
  }

  /**
   * Get cell values
   */
  async getCells(
    spreadsheetId: string,
    range: string,
    sheetName?: string
  ): Promise<any[][]> {
    try {
      const fullRange = sheetName ? `${sheetName}!${range}` : range;

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: fullRange,
      });

      return response.data.values || [];
    } catch (error) {
      logger.error('Failed to get cells', { error, spreadsheetId, range });
      throw this.handleError(error);
    }
  }

  /**
   * Format cells (bold, color, alignment, etc.)
   */
  async formatCells(
    spreadsheetId: string,
    range: string,
    format: sheets_v4.Schema$CellFormat,
    sheetId: number = 0
  ): Promise<void> {
    try {
      logger.info('Formatting cells', { spreadsheetId, range, format });

      const requests: sheets_v4.Schema$Request[] = [
        {
          repeatCell: {
            range: this.parseRangeToGridRange(range, sheetId),
            cell: {
              userEnteredFormat: format,
            },
            fields: 'userEnteredFormat',
          },
        },
      ];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });

      logger.info('Cells formatted successfully');
    } catch (error) {
      logger.error('Failed to format cells', { error, spreadsheetId, range });
      throw this.handleError(error);
    }
  }

  /**
   * Insert rows
   */
  async insertRows(
    spreadsheetId: string,
    sheetId: number,
    startIndex: number,
    count: number
  ): Promise<void> {
    try {
      logger.info('Inserting rows', { spreadsheetId, sheetId, startIndex, count });

      const requests: sheets_v4.Schema$Request[] = [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex,
              endIndex: startIndex + count,
            },
          },
        },
      ];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });

      logger.info('Rows inserted successfully');
    } catch (error) {
      logger.error('Failed to insert rows', { error, spreadsheetId, sheetId });
      throw this.handleError(error);
    }
  }

  /**
   * Insert columns
   */
  async insertColumns(
    spreadsheetId: string,
    sheetId: number,
    startIndex: number,
    count: number
  ): Promise<void> {
    try {
      logger.info('Inserting columns', { spreadsheetId, sheetId, startIndex, count });

      const requests: sheets_v4.Schema$Request[] = [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex,
              endIndex: startIndex + count,
            },
          },
        },
      ];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });

      logger.info('Columns inserted successfully');
    } catch (error) {
      logger.error('Failed to insert columns', { error, spreadsheetId, sheetId });
      throw this.handleError(error);
    }
  }

  /**
   * Delete rows
   */
  async deleteRows(
    spreadsheetId: string,
    sheetId: number,
    startIndex: number,
    count: number
  ): Promise<void> {
    try {
      logger.info('Deleting rows', { spreadsheetId, sheetId, startIndex, count });

      const requests: sheets_v4.Schema$Request[] = [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex,
              endIndex: startIndex + count,
            },
          },
        },
      ];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });

      logger.info('Rows deleted successfully');
    } catch (error) {
      logger.error('Failed to delete rows', { error, spreadsheetId, sheetId });
      throw this.handleError(error);
    }
  }

  /**
   * Sort data by column
   */
  async sortData(
    spreadsheetId: string,
    sheetId: number,
    range: sheets_v4.Schema$GridRange,
    sortColumnIndex: number,
    ascending: boolean = true
  ): Promise<void> {
    try {
      logger.info('Sorting data', { spreadsheetId, sheetId, sortColumnIndex, ascending });

      const requests: sheets_v4.Schema$Request[] = [
        {
          sortRange: {
            range,
            sortSpecs: [
              {
                dimensionIndex: sortColumnIndex,
                sortOrder: ascending ? 'ASCENDING' : 'DESCENDING',
              },
            ],
          },
        },
      ];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });

      logger.info('Data sorted successfully');
    } catch (error) {
      logger.error('Failed to sort data', { error, spreadsheetId, sheetId });
      throw this.handleError(error);
    }
  }

  /**
   * Create a chart
   */
  async createChart(
    spreadsheetId: string,
    sheetId: number,
    chartType: 'BAR' | 'LINE' | 'PIE' | 'COLUMN',
    dataRange: sheets_v4.Schema$GridRange,
    position?: { rowIndex: number; columnIndex: number }
  ): Promise<void> {
    try {
      logger.info('Creating chart', { spreadsheetId, sheetId, chartType });

      const requests: sheets_v4.Schema$Request[] = [
        {
          addChart: {
            chart: {
              spec: {
                title: 'Chart',
                basicChart: {
                  chartType,
                  domains: [
                    {
                      domain: {
                        sourceRange: {
                          sources: [dataRange],
                        },
                      },
                    },
                  ],
                },
              },
              position: position
                ? {
                    overlayPosition: {
                      anchorCell: {
                        sheetId,
                        rowIndex: position.rowIndex,
                        columnIndex: position.columnIndex,
                      },
                    },
                  }
                : undefined,
            },
          },
        },
      ];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });

      logger.info('Chart created successfully');
    } catch (error) {
      logger.error('Failed to create chart', { error, spreadsheetId, sheetId });
      throw this.handleError(error);
    }
  }

  /**
   * Freeze rows
   */
  async freezeRows(spreadsheetId: string, sheetId: number, rowCount: number): Promise<void> {
    try {
      logger.info('Freezing rows', { spreadsheetId, sheetId, rowCount });

      const requests: sheets_v4.Schema$Request[] = [
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: {
                frozenRowCount: rowCount,
              },
            },
            fields: 'gridProperties.frozenRowCount',
          },
        },
      ];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });

      logger.info('Rows frozen successfully');
    } catch (error) {
      logger.error('Failed to freeze rows', { error, spreadsheetId, sheetId });
      throw this.handleError(error);
    }
  }

  /**
   * Merge cells
   */
  async mergeCells(
    spreadsheetId: string,
    range: sheets_v4.Schema$GridRange,
    mergeType: 'MERGE_ALL' | 'MERGE_COLUMNS' | 'MERGE_ROWS' = 'MERGE_ALL'
  ): Promise<void> {
    try {
      logger.info('Merging cells', { spreadsheetId, range, mergeType });

      const requests: sheets_v4.Schema$Request[] = [
        {
          mergeCells: {
            range,
            mergeType,
          },
        },
      ];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });

      logger.info('Cells merged successfully');
    } catch (error) {
      logger.error('Failed to merge cells', { error, spreadsheetId });
      throw this.handleError(error);
    }
  }

  /**
   * Parse A1 notation to GridRange
   */
  private parseRangeToGridRange(range: string, sheetId: number): sheets_v4.Schema$GridRange {
    // Simplified parser - handles basic ranges like "A1:B10" or "1:1"
    const match = range.match(/^([A-Z]+)?(\d+)?(?::([A-Z]+)?(\d+)?)?$/);

    if (!match) {
      throw new Error(`Invalid range format: ${range}`);
    }

    const [, startCol, startRow, endCol, endRow] = match;

    return {
      sheetId,
      startRowIndex: startRow ? parseInt(startRow) - 1 : undefined,
      endRowIndex: endRow ? parseInt(endRow) : undefined,
      startColumnIndex: startCol ? this.columnToIndex(startCol) : undefined,
      endColumnIndex: endCol ? this.columnToIndex(endCol) + 1 : undefined,
    };
  }

  /**
   * Convert column letter to index (A=0, B=1, etc.)
   */
  private columnToIndex(column: string): number {
    let index = 0;
    for (let i = 0; i < column.length; i++) {
      index = index * 26 + (column.charCodeAt(i) - 65 + 1);
    }
    return index - 1;
  }

  /**
   * Handle Google Sheets API errors
   */
  private handleError(error: any): Error {
    if (error.response?.data?.error) {
      const apiError = error.response.data.error;
      return new Error(`Google Sheets API error: ${apiError.message || apiError.code}`);
    }
    return new Error(`Google Sheets operation failed: ${error.message}`);
  }
}

/**
 * Factory function to create GoogleSheetsService for a user
 */
export async function getGoogleSheetsService(userId: string): Promise<GoogleSheetsService> {
  try {
    const token = await prisma.googleToken.findUnique({
      where: { userId },
    });

    if (!token) {
      throw new Error('User has not connected Google Sheets. Please authenticate first.');
    }

    // Check if token is expired
    if (new Date() > token.expiresAt) {
      throw new Error('Google authentication token has expired. Please re-authenticate.');
    }

    const accessToken = decrypt(token.accessToken);
    const refreshToken = token.refreshToken ? decrypt(token.refreshToken) : undefined;

    return new GoogleSheetsService(accessToken, refreshToken);
  } catch (error) {
    logger.error('Failed to create GoogleSheetsService', { error, userId });
    throw error;
  }
}

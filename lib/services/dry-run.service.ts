// Dry-Run Service - Simulates sheet operations without execution
// Provides safety validation before actual modifications

import { logger } from '@/lib/utils/logger';
import type { sheets_v4 } from 'googleapis';

export interface DryRunResult {
  cells_affected: string[];
  rows_affected?: number[];
  columns_affected?: string[];
  risk_level: 'low' | 'medium' | 'high';
  reversible: boolean;
  preview: string;
  warnings?: string[];
  estimated_impact: {
    cells: number;
    rows?: number;
    columns?: number;
  };
}

export interface ExecutionPlan {
  action: string;
  parameters: Record<string, any>;
  target_sheet?: string;
  steps: ExecutionStep[];
}

export interface ExecutionStep {
  action: string;
  range?: string;
  value?: any;
  format?: any;
  sheetId?: number;
  [key: string]: any;
}

export class DryRunService {
  /**
   * Perform dry-run simulation for a sheet action
   */
  async simulate(
    action: string,
    parameters: Record<string, any>,
    sheetId: string
  ): Promise<DryRunResult> {
    try {
      logger.info('Running dry-run simulation', { action, sheetId });

      switch (action) {
        case 'create_spreadsheet':
          return this.simulateCreateSpreadsheet(parameters);

        case 'update_cell':
        case 'update_range':
          return this.simulateUpdateCells(parameters);

        case 'format_cells':
          return this.simulateFormatCells(parameters);

        case 'insert_row':
          return this.simulateInsertRows(parameters);

        case 'insert_column':
          return this.simulateInsertColumns(parameters);

        case 'delete_row':
          return this.simulateDeleteRows(parameters);

        case 'delete_column':
          return this.simulateDeleteColumns(parameters);

        case 'clear_range':
          return this.simulateClearRange(parameters);

        case 'sort_data':
          return this.simulateSortData(parameters);

        case 'merge_cells':
          return this.simulateMergeCells(parameters);

        case 'freeze_rows':
        case 'freeze_columns':
          return this.simulateFreezeRows(parameters);

        case 'create_chart':
          return this.simulateCreateChart(parameters);

        case 'apply_formula':
          return this.simulateApplyFormula(parameters);

        case 'append_transaction':
          return this.simulateAppendTransaction(parameters);

        case 'create_tally_sheet':
          return this.simulateCreateTallySheet(parameters);

        default:
          throw new Error(`Unsupported action for dry-run: ${action}`);
      }
    } catch (error) {
      logger.error('Dry-run simulation failed', { error, action });
      throw new Error(`Dry-run failed: ${(error as Error).message}`);
    }
  }

  /**
   * Simulate creating a new spreadsheet
   */
  private simulateCreateSpreadsheet(params: any): DryRunResult {
    const { title, sheetNames } = params;

    return {
      cells_affected: [],
      risk_level: 'low',
      reversible: false, // Can't undo creation easily
      preview: `Will create new spreadsheet "${title}"${
        sheetNames ? ` with sheets: ${sheetNames.join(', ')}` : ''
      }`,
      estimated_impact: {
        cells: 0,
      },
    };
  }

  /**
   * Simulate updating cells
   */
  private simulateUpdateCells(params: any): DryRunResult {
    const { range, values, sheetName } = params;
    const cellCount = this.countCellsInRange(values);

    const affectedCells = this.expandRange(range);

    return {
      cells_affected: affectedCells,
      risk_level: cellCount > 100 ? 'medium' : 'low',
      reversible: true,
      preview: `Will update ${cellCount} cell(s) in range ${
        sheetName ? sheetName + '!' : ''
      }${range}`,
      warnings:
        cellCount > 100
          ? ['Large update detected - affects more than 100 cells']
          : undefined,
      estimated_impact: {
        cells: cellCount,
      },
    };
  }

  /**
   * Simulate formatting cells
   */
  private simulateFormatCells(params: any): DryRunResult {
    const { range, format, sheetName } = params;
    const affectedCells = this.expandRange(range);

    const formatDesc = this.describeFormat(format);

    return {
      cells_affected: affectedCells,
      risk_level: 'low',
      reversible: true,
      preview: `Will apply ${formatDesc} to range ${
        sheetName ? sheetName + '!' : ''
      }${range}`,
      estimated_impact: {
        cells: affectedCells.length,
      },
    };
  }

  /**
   * Simulate inserting rows
   */
  private simulateInsertRows(params: any): DryRunResult {
    const { startIndex, count = 1 } = params;
    const rows = Array.from({ length: count }, (_, i) => startIndex + i + 1);

    return {
      cells_affected: [],
      rows_affected: rows,
      risk_level: count > 10 ? 'medium' : 'low',
      reversible: true,
      preview: `Will insert ${count} row(s) starting at row ${startIndex + 1}`,
      warnings: count > 10 ? ['Inserting more than 10 rows'] : undefined,
      estimated_impact: {
        cells: 0,
        rows: count,
      },
    };
  }

  /**
   * Simulate inserting columns
   */
  private simulateInsertColumns(params: any): DryRunResult {
    const { startIndex, count = 1 } = params;
    const columns = Array.from({ length: count }, (_, i) =>
      this.indexToColumn(startIndex + i)
    );

    return {
      cells_affected: [],
      columns_affected: columns,
      risk_level: count > 5 ? 'medium' : 'low',
      reversible: true,
      preview: `Will insert ${count} column(s) starting at column ${this.indexToColumn(
        startIndex
      )}`,
      warnings: count > 5 ? ['Inserting more than 5 columns'] : undefined,
      estimated_impact: {
        cells: 0,
        columns: count,
      },
    };
  }

  /**
   * Simulate deleting rows
   */
  private simulateDeleteRows(params: any): DryRunResult {
    const { startIndex, count = 1 } = params;
    const rows = Array.from({ length: count }, (_, i) => startIndex + i + 1);

    return {
      cells_affected: [],
      rows_affected: rows,
      risk_level: 'high', // Deletion is always high risk
      reversible: true,
      preview: `⚠️  Will DELETE ${count} row(s) starting at row ${
        startIndex + 1
      }. This action removes data.`,
      warnings: ['This is a destructive action', 'All data in these rows will be removed'],
      estimated_impact: {
        cells: 0,
        rows: count,
      },
    };
  }

  /**
   * Simulate deleting columns
   */
  private simulateDeleteColumns(params: any): DryRunResult {
    const { startIndex, count = 1 } = params;

    return {
      cells_affected: [],
      risk_level: 'high',
      reversible: true,
      preview: `⚠️  Will DELETE ${count} column(s) starting at column ${this.indexToColumn(
        startIndex
      )}. This action removes data.`,
      warnings: ['This is a destructive action', 'All data in these columns will be removed'],
      estimated_impact: {
        cells: 0,
        columns: count,
      },
    };
  }

  /**
   * Simulate clearing a range
   */
  private simulateClearRange(params: any): DryRunResult {
    const { range, sheetName } = params;
    const affectedCells = this.expandRange(range);

    return {
      cells_affected: affectedCells,
      risk_level: 'high',
      reversible: true,
      preview: `⚠️  Will CLEAR ${affectedCells.length} cell(s) in range ${
        sheetName ? sheetName + '!' : ''
      }${range}. All content will be removed.`,
      warnings: [
        'This is a destructive action',
        'Cell contents will be permanently cleared',
      ],
      estimated_impact: {
        cells: affectedCells.length,
      },
    };
  }

  /**
   * Simulate sorting data
   */
  private simulateSortData(params: any): DryRunResult {
    const { range, columnIndex, ascending } = params;

    return {
      cells_affected: this.expandRange(range),
      risk_level: 'medium',
      reversible: false, // Sorting changes order permanently
      preview: `Will sort data by column ${this.indexToColumn(
        columnIndex
      )} in ${ascending ? 'ascending' : 'descending'} order`,
      warnings: ['Sorting changes the order of rows', 'This action cannot be easily undone'],
      estimated_impact: {
        cells: this.expandRange(range).length,
      },
    };
  }

  /**
   * Simulate merging cells
   */
  private simulateMergeCells(params: any): DryRunResult {
    const { range } = params;

    return {
      cells_affected: this.expandRange(range),
      risk_level: 'low',
      reversible: true,
      preview: `Will merge cells in range ${range}`,
      estimated_impact: {
        cells: this.expandRange(range).length,
      },
    };
  }


  /**
   * Simulate appending a business transaction row
   */
  private simulateAppendTransaction(params: any): DryRunResult {
    const tx = params.transaction || {};
    const amount = tx.amount ?? params.amount ?? 0;

    return {
      cells_affected: [],
      risk_level: 'low',
      reversible: true,
      preview: `Will append a ${tx.type || 'transaction'} entry (${amount}) to ${params.sheetName || 'the active sheet'}`,
      estimated_impact: {
        cells: 5,
        rows: 1,
      },
    };
  }

  /**
   * Simulate creating a business tally sheet with headers
   */
  private simulateCreateTallySheet(params: any): DryRunResult {
    return {
      cells_affected: ['A1', 'B1', 'C1', 'D1', 'E1'],
      risk_level: 'low',
      reversible: false,
      preview: `Will create a new tally spreadsheet "${params.title || 'Business Tally Sheet'}" with columns Date, Type, Category, Description, Amount`,
      estimated_impact: {
        cells: 5,
        rows: 1,
        columns: 5,
      },
    };
  }

  /**
   * Simulate freezing rows/columns
   */
  private simulateFreezeRows(params: any): DryRunResult {
    const { rowCount, columnCount } = params;

    return {
      cells_affected: [],
      risk_level: 'low',
      reversible: true,
      preview: `Will freeze ${rowCount || 0} row(s) and ${columnCount || 0} column(s)`,
      estimated_impact: {
        cells: 0,
      },
    };
  }

  /**
   * Simulate creating a chart
   */
  private simulateCreateChart(params: any): DryRunResult {
    const { chartType, dataRange } = params;

    return {
      cells_affected: [],
      risk_level: 'low',
      reversible: true,
      preview: `Will create a ${chartType.toLowerCase()} chart`,
      estimated_impact: {
        cells: 0,
      },
    };
  }

  /**
   * Simulate applying a formula
   */
  private simulateApplyFormula(params: any): DryRunResult {
    const { range, formula } = params;
    const affectedCells = this.expandRange(range);

    return {
      cells_affected: affectedCells,
      risk_level: 'low',
      reversible: true,
      preview: `Will apply formula "${formula}" to ${affectedCells.length} cell(s)`,
      estimated_impact: {
        cells: affectedCells.length,
      },
    };
  }

  /**
   * Expand A1 notation range to array of cells
   * Simplified implementation - handles basic ranges
   */
  private expandRange(range: string): string[] {
    // Handle simple patterns like "A1", "A1:B2", "1:1", "A:A"
    const cells: string[] = [];

    // For simplicity, just return the range as-is
    // In production, would parse and expand to individual cells
    return [range];
  }

  /**
   * Count cells in values array
   */
  private countCellsInRange(values: any[][]): number {
    return values.reduce((sum, row) => sum + row.length, 0);
  }

  /**
   * Describe format object in human-readable way
   */
  private describeFormat(format: any): string {
    const parts: string[] = [];

    if (format.bold) parts.push('bold');
    if (format.italic) parts.push('italic');
    if (format.underline) parts.push('underline');
    if (format.textColor) parts.push('text color');
    if (format.backgroundColor) parts.push('background color');
    if (format.fontSize) parts.push(`font size ${format.fontSize}`);
    if (format.numberFormat) parts.push(`number format`);

    return parts.length > 0 ? parts.join(', ') : 'formatting';
  }

  /**
   * Convert column index to letter (0 -> A, 1 -> B, etc.)
   */
  private indexToColumn(index: number): string {
    let column = '';
    let temp = index;

    while (temp >= 0) {
      column = String.fromCharCode((temp % 26) + 65) + column;
      temp = Math.floor(temp / 26) - 1;
    }

    return column;
  }
}

// Singleton instance
let dryRunService: DryRunService | null = null;

export function getDryRunService(): DryRunService {
  if (!dryRunService) {
    dryRunService = new DryRunService();
  }
  return dryRunService;
}

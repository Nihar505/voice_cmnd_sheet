'use client';

import { FileSpreadsheet, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import type { Spreadsheet } from '@/lib/types';

interface SheetSelectorProps {
  sheets: Spreadsheet[];
  selectedSheet: Spreadsheet | null;
  onSelect: (sheet: Spreadsheet) => void;
  onRefresh: () => void;
}

export function SheetSelector({
  sheets,
  selectedSheet,
  onSelect,
  onRefresh,
}: SheetSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectedSheet?.id || ''}
        onChange={(e) => {
          const sheet = sheets.find((s) => s.id === e.target.value);
          if (sheet) onSelect(sheet);
        }}
        className="flex-1"
      >
        <option value="" disabled>
          Select a sheet...
        </option>
        {sheets.map((sheet) => (
          <option key={sheet.id} value={sheet.id}>
            {sheet.name}
          </option>
        ))}
      </Select>
      <Button variant="ghost" size="icon" onClick={onRefresh} title="Refresh sheets">
        <RefreshCw className="h-4 w-4" />
      </Button>
      {selectedSheet?.url && (
        <a
          href={selectedSheet.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Google Sheets"
        >
          <Button variant="ghost" size="icon">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </a>
      )}
    </div>
  );
}

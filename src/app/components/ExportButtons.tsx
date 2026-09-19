'use client';

import { Button } from '@heroui/react';
import type { ExportFormat } from '../lib/frontoffice/reportExportFormat';

export default function ExportButtons({ onDownload }: { onDownload: (format: ExportFormat) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="flat" onPress={() => onDownload('excel')}>⬇ Excel</Button>
      <Button size="sm" variant="flat" onPress={() => onDownload('pdf')}>⬇ PDF</Button>
      <Button size="sm" variant="flat" onPress={() => onDownload('print')}>🖨 Print</Button>
    </div>
  );
}

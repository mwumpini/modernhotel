'use client';

import { useSettingsStore } from '../settings/store';
import { useCurrentUserName } from '../auth/useCurrentUserName';
import { buildOrgProfile } from '../print/buildOrgProfile';
import { downloadSections, type ExportFormat, type ExportSection } from '../frontoffice/reportExportFormat';

/** Returns a function that downloads one table as Excel or landscape PDF, with the hotel
 * header and "Generated on … by …" line the Front Office reports already carry. */
export function useSectionExport() {
  const userName = useCurrentUserName();
  return (format: ExportFormat, name: string, section: ExportSection, note?: string) =>
    downloadSections({
      format,
      filename: `${name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`,
      title: name,
      sections: [section],
      org: buildOrgProfile(useSettingsStore.getState()),
      generatedLabel: `${note ? note + ' · ' : ''}Generated on ${new Date().toLocaleString('en-GB')} by ${userName}`,
      landscape: true,
    });
}

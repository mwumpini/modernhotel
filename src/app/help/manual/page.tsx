'use client';

import ManualView from './ManualView';

/** The whole Help as one printable manual (?print=1 opens the print window). */
export default function HelpManualPage() {
  return <ManualView variant="user" />;
}

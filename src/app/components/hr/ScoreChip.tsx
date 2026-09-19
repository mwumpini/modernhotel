'use client';

import { Chip } from '@heroui/react';
import { fmtScore } from '@/app/lib/hr/performanceLog';

/** Green ▲ for a commendation, red ▼ for a concern. */
export default function ScoreChip({ score }: { score: number }) {
  return (
    <Chip size="sm" variant="flat" color={score > 0 ? 'success' : 'danger'}>
      {score > 0 ? '▲' : '▼'} {fmtScore(score)}
    </Chip>
  );
}

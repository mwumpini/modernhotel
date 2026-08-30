'use client';

import Link from 'next/link';
import { buildCreateClientUrl } from '../../lib/frontoffice/createClientUrl';

type Props = {
  searchTerm: string;
};

export default function GuestSearchCreateClientLink({ searchTerm }: Props) {
  if (!searchTerm.trim()) return null;

  return (
    <div className="mt-3 pt-2 border-t border-gray-100">
      <Link
        href={buildCreateClientUrl({ name: searchTerm })}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-purple-700 hover:text-purple-900 underline"
      >
        + Create new client
      </Link>
      <span className="block text-xs text-gray-400 mt-1">Opens in a new tab — your reservation stays here</span>
    </div>
  );
}

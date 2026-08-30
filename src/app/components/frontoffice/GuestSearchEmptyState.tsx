'use client';

import GuestSearchCreateClientLink from './GuestSearchCreateClientLink';

type Props = {
  searchTerm: string;
};

export default function GuestSearchEmptyState({ searchTerm }: Props) {
  return (
    <div className="p-3 text-center">
      <div className="text-sm text-gray-600">No guests found matching &ldquo;{searchTerm.trim()}&rdquo;</div>
      <div className="text-xs mt-1 text-gray-400">Try name, phone, email, or ID number</div>
      <GuestSearchCreateClientLink searchTerm={searchTerm} />
    </div>
  );
}

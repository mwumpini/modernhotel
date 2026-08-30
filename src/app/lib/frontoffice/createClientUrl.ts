export const CREATE_CLIENT_PATH = '/guest-services/client-services/clients-services';

export function buildCreateClientUrl(opts?: {
  name?: string;
  type?: 'individual' | 'corporate';
}): string {
  const params = new URLSearchParams({
    new: '1',
    type: opts?.type || 'individual',
  });
  const name = opts?.name?.trim();
  if (name) params.set('name', name);
  return `${CREATE_CLIENT_PATH}?${params.toString()}`;
}

export function shouldOfferCreateClientLink(opts: {
  isSearching: boolean;
  searchTerm: string;
  resultCount: number;
  searchError: string | null;
}): boolean {
  const term = opts.searchTerm.trim();
  if (opts.isSearching || term.length < 2) return false;
  if (opts.resultCount > 0) return false;
  return opts.searchError === 'No guests found matching your search';
}

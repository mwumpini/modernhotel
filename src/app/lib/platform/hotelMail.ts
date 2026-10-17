/** A hotel's outgoing mailbox. The password stays in the hotel record and is never sent back to the browser. */

export type HotelMail = {
  host: string;
  port: number;
  user: string;
  pass: string;
};

export type HotelMailSummary = {
  host: string;
  port: number;
  user: string;
};

function bag(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
}

export function readHotelMail(metadata: unknown): HotelMail | null {
  const raw = bag(metadata).mail;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const mail = raw as Record<string, unknown>;
  const host = String(mail.host || '').trim();
  const user = String(mail.user || '').trim();
  const pass = String(mail.pass || '');
  const port = Number(mail.port);
  if (!host || !user || !pass || (port !== 465 && port !== 587)) return null;
  return { host, port, user, pass };
}

export function hotelMailSummary(metadata: unknown): HotelMailSummary | null {
  const mail = readHotelMail(metadata);
  if (!mail) return null;
  return { host: mail.host, port: mail.port, user: mail.user };
}

export function parseHotelMail(
  input: { host?: unknown; port?: unknown; user?: unknown; pass?: unknown },
  existing: HotelMail | null,
): { ok: true; mail: HotelMail | null } | { ok: false; error: string } {
  const host = String(input.host ?? '').trim();
  const user = String(input.user ?? '').trim();
  const pass = String(input.pass ?? '');
  const portRaw = String(input.port ?? '').trim();
  if (!host && !user && !pass) return { ok: true, mail: null };

  if (!/^[a-z0-9.-]+$/i.test(host) || !host.includes('.')) return { ok: false, error: 'Enter the outgoing server, such as mail.hotel.com.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) return { ok: false, error: 'Enter the mailbox address, such as marketing@hotel.com.' };
  const port = portRaw ? Number(portRaw) : 465;
  if (port !== 465 && port !== 587) return { ok: false, error: 'Use SMTP port 465 (secure) or 587.' };
  const saved = pass || existing?.pass || '';
  if (!saved) return { ok: false, error: 'Enter the mailbox password.' };
  return { ok: true, mail: { host, port, user, pass: saved } };
}

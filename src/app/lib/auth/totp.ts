import { createHmac, randomBytes } from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** 160-bit authenticator secret, base32, no padding. */
export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function decodeBase32(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const c of clean) {
    const val = ALPHABET.indexOf(c);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** RFC 6238 code, 30-second step, 6 digits. */
export function totpCode(secret: string, at = Date.now()): string {
  const counter = Math.floor(at / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', decodeBase32(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[offset] & 0x7f) << 24)
    | (hmac[offset + 1] << 16)
    | (hmac[offset + 2] << 8)
    | hmac[offset + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret: string, code: string, at = Date.now()): boolean {
  const cleaned = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleaned) || !secret) return false;
  for (const skew of [-1, 0, 1]) {
    if (totpCode(secret, at + skew * 30_000) === cleaned) return true;
  }
  return false;
}

export function otpauthUri(secret: string, email: string, issuer = 'Ghana Hotel'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
}

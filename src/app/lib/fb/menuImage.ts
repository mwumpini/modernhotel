/**
 * Menu photos are stored on FBMenuItem.imageUrl as a small JPEG/PNG/WebP data URL (the browser shrinks
 * the picture before upload). The menu list never sends them; each photo is fetched from
 * /api/fb/menu/image so the POS menu stays light and the browser can cache every picture.
 */
export const MAX_MENU_IMAGE_BYTES = 300 * 1024

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/

export function parseMenuImage(value: unknown): { mime: string; bytes: Buffer } | null {
  if (typeof value !== 'string') return null
  const match = DATA_URL.exec(value)
  if (!match) return null
  const bytes = Buffer.from(match[2], 'base64')
  return bytes.length > 0 && bytes.length <= MAX_MENU_IMAGE_BYTES ? { mime: match[1], bytes } : null
}

/**
 * What an incoming imageUrl field means for the stored value:
 * undefined → leave as is; null or '' → remove the photo; a valid data URL → store it.
 */
export function incomingMenuImage(value: unknown): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: undefined }
  if (value === null || value === '') return { ok: true, value: null }
  if (!parseMenuImage(value)) return { ok: false, error: 'The photo must be a JPEG, PNG or WebP under 300 KB.' }
  return { ok: true, value: value as string }
}

/** The menu item as the list returns it: the photo itself is left out; hasImage/imageVersion say where to fetch it. */
export function withoutImage<T extends { imageUrl?: string | null; updatedAt?: Date | string }>(item: T) {
  const { imageUrl, ...rest } = item
  return {
    ...rest,
    hasImage: !!imageUrl,
    imageVersion: item.updatedAt ? new Date(item.updatedAt).getTime() : 0,
  }
}

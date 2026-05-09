// Byte conversion helpers. Workers runtime has TextEncoder/TextDecoder + crypto;
// no Buffer. base64url for cookies and tokens (URL-safe, no padding).

const enc = new TextEncoder()
const dec = new TextDecoder()

export function utf8ToBytes(s: string): Uint8Array {
  return enc.encode(s)
}

export function bytesToUtf8(b: Uint8Array): string {
  return dec.decode(b)
}

export function bytesToB64url(b: Uint8Array): string {
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function randomTokenB64url(byteLen = 32): string {
  const buf = new Uint8Array(byteLen)
  crypto.getRandomValues(buf)
  return bytesToB64url(buf)
}

// SHA-256 a string and return base64url. Used for at-rest hashing of magic-link
// tokens — we send the plaintext in the URL once, store only the hash, and look
// up by hash on /verify. A DB snapshot leak no longer leaks usable tokens.
export async function sha256B64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', utf8ToBytes(input))
  return bytesToB64url(new Uint8Array(digest))
}

// Constant-time byte comparison. Workers crypto.subtle.verify already does this
// for HMAC; this helper is for any ad-hoc string comparison we add later.
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

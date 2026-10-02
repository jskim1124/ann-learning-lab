import { createCipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export function mac(secret: string, value: string): string { return createHmac('sha256', secret).update(value).digest('base64url'); }
export function equal(a: string, b: string): boolean { return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
export function pseudonym(secret: string, study: string, subject: string): string { return `p_${mac(secret, JSON.stringify([study, 'https://accounts.google.com', subject]))}`; }
export function encryptSubject(key: string, subject: string, study: string): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'base64'), iv);
  cipher.setAAD(Buffer.from(study));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify({ issuer: 'https://accounts.google.com', sub: subject }), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}
export function seal(secret: string, value: object): string { const body = Buffer.from(JSON.stringify(value)).toString('base64url'); return `${body}.${mac(secret, body)}`; }
export function unseal<T extends { exp: number }>(secret: string, value: string | undefined, now = Date.now()): T | null {
  if (!value || value.length > 6000) return null;
  const [body, signature, extra] = value.split('.');
  if (!body || !signature || extra || !equal(mac(secret, body), signature)) return null;
  try { const result = JSON.parse(Buffer.from(body, 'base64url').toString()) as T; return Number.isFinite(result.exp) && result.exp > now ? result : null; } catch { return null; }
}

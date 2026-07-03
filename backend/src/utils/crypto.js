/**
 * JWT (HMAC-SHA256) and password hashing for Cloudflare Workers
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;

function base64UrlEncode(data) {
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parseExpiresIn(expiresIn = '7d') {
  if (typeof expiresIn === 'number') return expiresIn;
  const match = String(expiresIn).match(/^(\d+)([dhms])$/);
  if (!match) return 7 * 24 * 60 * 60;
  const n = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 'd') return n * 24 * 60 * 60;
  if (unit === 'h') return n * 60 * 60;
  if (unit === 'm') return n * 60;
  return n;
}

async function importJwtKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createJWT(payload, secret, expiresIn = '7d') {
  if (!secret) throw new Error('JWT_SECRET is not configured');

  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, exp: now + parseExpiresIn(expiresIn), iat: now };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importJwtKey(secret);
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const signature = base64UrlEncode(new Uint8Array(sigBuffer));

  return `${signingInput}.${signature}`;
}

export async function verifyJWT(token, secret) {
  if (!secret || !token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  try {
    const key = await importJwtKey(secret);
    const sigBytes = base64UrlDecode(signature);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(signingInput)
    );
    if (!valid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(encodedPayload));
    const payload = JSON.parse(payloadJson);

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Hash password with PBKDF2-SHA256. Stored format: pbkdf2:iterations:saltHex:hashHex
 */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

async function verifyPbkdf2Password(password, stored) {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const iterations = parseInt(parts[1], 10);
  const saltHex = parts[2];
  const expectedHash = parts[3];
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex === expectedHash;
}

/** Legacy unsalted SHA-256 hex (pre-migration Workers hashes) */
async function verifyLegacySha256(password, stored) {
  if (!stored || stored.includes(':')) return false;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex === stored;
}

export async function comparePassword(password, storedHash) {
  if (!storedHash) return false;
  if (storedHash.startsWith('pbkdf2:')) {
    return verifyPbkdf2Password(password, storedHash);
  }
  return verifyLegacySha256(password, storedHash);
}

/** Re-hash to PBKDF2 after successful legacy login */
export function needsPasswordRehash(storedHash) {
  return storedHash && !storedHash.startsWith('pbkdf2:');
}

async function deriveAesKey(secret) {
  const material = new TextEncoder().encode(secret || 'fallback-dev-key');
  const hash = await crypto.subtle.digest('SHA-256', material);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Encrypt sensitive settings (e.g. SMTP password) — format enc:ivB64:cipherB64 */
export async function encryptSecret(plaintext, secret) {
  if (!plaintext) return '';
  const key = await deriveAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return `enc:${base64UrlEncode(iv)}:${base64UrlEncode(new Uint8Array(cipher))}`;
}

export async function decryptSecret(stored, secret) {
  if (!stored) return '';
  if (!stored.startsWith('enc:')) return stored;
  const parts = stored.split(':');
  if (parts.length !== 3) return '';
  const iv = base64UrlDecode(parts[1]);
  const cipher = base64UrlDecode(parts[2]);
  const key = await deriveAesKey(secret);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

import crypto from 'node:crypto';

function key() {
  const raw = process.env.MCP_AUTH_SECRET?.trim();
  if (!raw) throw new Error('MCP_AUTH_SECRET is not configured');
  let decoded;
  try {
    decoded = Buffer.from(raw, 'base64url');
  } catch {
    throw new Error('MCP_AUTH_SECRET must be base64url');
  }
  if (decoded.length !== 32) throw new Error('MCP_AUTH_SECRET must decode to exactly 32 bytes');
  return decoded;
}

export function randomBase64url(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256Base64url(value) {
  return crypto.createHash('sha256').update(String(value)).digest('base64url');
}

export function timingSafeEqualText(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function seal(kind, payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(`eve-esi-llm-bridge:${kind}:v1`));
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(payload))), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${Buffer.concat([iv, tag, ciphertext]).toString('base64url')}`;
}

export function open(kind, token) {
  const [version, encoded, ...rest] = String(token || '').split('.');
  if (version !== 'v1' || !encoded || rest.length) throw new Error(`invalid ${kind} token`);
  const raw = Buffer.from(encoded, 'base64url');
  if (raw.length < 29) throw new Error(`invalid ${kind} token`);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  decipher.setAAD(Buffer.from(`eve-esi-llm-bridge:${kind}:v1`));
  decipher.setAuthTag(raw.subarray(12, 28));
  let payload;
  try {
    payload = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'));
  } catch {
    throw new Error(`invalid ${kind} token`);
  }
  return payload;
}

export function sealExpiring(kind, payload, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  return seal(kind, { ...payload, iat: now, exp: now + ttlSeconds });
}

export function openExpiring(kind, token, { clockSkewSeconds = 30 } = {}) {
  const payload = open(kind, token);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(payload.exp) || payload.exp < now - clockSkewSeconds) throw new Error(`${kind} token expired`);
  if (Number.isFinite(payload.iat) && payload.iat > now + clockSkewSeconds) throw new Error(`${kind} token issued in the future`);
  return payload;
}

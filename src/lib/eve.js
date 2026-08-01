import { createRemoteJWKSet, jwtVerify } from 'jose';
import { EVE_SSO_METADATA, ESI_BASE, compatibilityDate, maxEsiPages, requireEveClientId, userAgent } from './runtime.js';
import { assertPrivateCharacterBinding, normalizeEsiPath } from './esi-policy.js';

let metadataCache = null;
let metadataUntil = 0;
let jwks = null;
let openApiCache = null;
let openApiUntil = 0;

export async function eveMetadata() {
  if (metadataCache && Date.now() < metadataUntil) return metadataCache;
  const response = await fetch(EVE_SSO_METADATA, { headers: { 'user-agent': userAgent(), accept: 'application/json' } });
  if (!response.ok) throw new Error(`EVE SSO metadata HTTP ${response.status}`);
  metadataCache = await response.json();
  metadataUntil = Date.now() + 5 * 60 * 1000;
  jwks = createRemoteJWKSet(new URL(metadataCache.jwks_uri));
  return metadataCache;
}

export async function validateEveAccessToken(accessToken) {
  const metadata = await eveMetadata();
  if (!jwks) jwks = createRemoteJWKSet(new URL(metadata.jwks_uri));
  const { payload } = await jwtVerify(accessToken, jwks, {
    issuer: ['https://login.eveonline.com/', 'https://login.eveonline.com', 'login.eveonline.com'],
    audience: 'EVE Online',
  });
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const clientId = requireEveClientId();
  if (!audiences.includes(clientId) || !audiences.includes('EVE Online')) throw new Error('EVE token audience mismatch');
  const subject = /^CHARACTER:EVE:(\d+)$/.exec(String(payload.sub || ''));
  if (!subject) throw new Error('EVE token subject mismatch');
  return {
    characterId: Number(subject[1]),
    characterName: String(payload.name || ''),
    scopes: Array.isArray(payload.scp) ? payload.scp.map(String) : [],
    exp: Number(payload.exp || 0),
  };
}

export async function exchangeEveAuthorizationCode({ code, codeVerifier }) {
  const metadata = await eveMetadata();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: requireEveClientId(),
    code_verifier: codeVerifier,
  });
  const response = await fetch(metadata.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': userAgent() },
    body,
  });
  const data = await safeJson(response);
  if (!response.ok) throw withDetails(`EVE token endpoint HTTP ${response.status}`, data);
  const identity = await validateEveAccessToken(data.access_token);
  if (!data.refresh_token) throw new Error('EVE SSO did not return a refresh token');
  return { ...data, identity };
}

export async function refreshEveTokens(refreshToken, expectedCharacterId) {
  const metadata = await eveMetadata();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: requireEveClientId(),
  });
  const response = await fetch(metadata.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': userAgent() },
    body,
  });
  const data = await safeJson(response);
  if (!response.ok) throw withDetails(`EVE refresh HTTP ${response.status}`, data);
  const identity = await validateEveAccessToken(data.access_token);
  if (expectedCharacterId && identity.characterId !== expectedCharacterId) throw new Error('EVE refresh changed character identity');
  return { ...data, refresh_token: data.refresh_token || refreshToken, identity };
}

export async function esiCall({ method = 'GET', path, query = {}, body = undefined, accessToken = null }) {
  const normalized = normalizeEsiPath(path);
  const url = new URL(`${ESI_BASE}${normalized}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) value.forEach((x) => url.searchParams.append(key, String(x)));
    else url.searchParams.set(key, String(value));
  }
  const headers = {
    accept: 'application/json',
    'user-agent': userAgent(),
    'x-compatibility-date': compatibilityDate(),
  };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  let encodedBody;
  if (body !== undefined && body !== null) {
    headers['content-type'] = 'application/json';
    encodedBody = JSON.stringify(body);
  }
  const response = await fetch(url, { method, headers, body: encodedBody });
  const data = await safeJson(response);
  const meta = {
    status: response.status,
    pages: Number(response.headers.get('x-pages') || 1),
    compatibilityDate: response.headers.get('x-compatibility-date'),
    etag: response.headers.get('etag'),
    expires: response.headers.get('expires'),
    errorLimitRemain: response.headers.get('x-esi-error-limit-remain'),
    errorLimitReset: response.headers.get('x-esi-error-limit-reset'),
  };
  if (!response.ok) throw withDetails(`ESI ${method} ${normalized} HTTP ${response.status}`, { data, meta });
  return { data, meta };
}

export async function esiGetAllPages({ path, query = {}, accessToken = null }) {
  const first = await esiCall({ method: 'GET', path, query, accessToken });
  if (!Array.isArray(first.data) || first.meta.pages <= 1) return first;
  const pages = Math.min(first.meta.pages, maxEsiPages());
  const combined = [...first.data];
  for (let page = 2; page <= pages; page += 1) {
    const next = await esiCall({ method: 'GET', path, query: { ...query, page }, accessToken });
    if (Array.isArray(next.data)) combined.push(...next.data);
    else combined.push(next.data);
  }
  return { data: combined, meta: { ...first.meta, pagesFetched: pages, truncated: first.meta.pages > pages } };
}

export async function esiOpenApi() {
  if (openApiCache && Date.now() < openApiUntil) return openApiCache;
  const response = await fetch(`${ESI_BASE}/meta/openapi.json`, {
    headers: { accept: 'application/openapi+json, application/json', 'user-agent': userAgent() },
  });
  if (!response.ok) throw new Error(`ESI OpenAPI HTTP ${response.status}`);
  openApiCache = await response.json();
  openApiUntil = Date.now() + 60 * 60 * 1000;
  return openApiCache;
}

function safeJson(response) {
  return response.text().then((text) => {
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  });
}

function withDetails(message, details) {
  const error = new Error(message);
  error.details = details;
  return error;
}

export { assertPrivateCharacterBinding, normalizeEsiPath } from './esi-policy.js';

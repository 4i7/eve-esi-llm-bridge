import crypto from 'node:crypto';
import { seal, open } from './crypto.js';

function normalizeRedirect(uri) {
  const u = new URL(uri);
  const loopback = u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !loopback) throw new Error('redirect URI must use HTTPS or a loopback HTTP address');
  if (u.username || u.password || u.hash) throw new Error('redirect URI contains unsupported components');
  return u.toString();
}

export function registerStatelessClient(metadata) {
  const redirects = [...new Set((metadata.redirect_uris || []).map(normalizeRedirect))];
  if (!redirects.length || redirects.length > 8) throw new Error('redirect_uris must contain between 1 and 8 entries');
  const method = metadata.token_endpoint_auth_method || 'none';
  if (method !== 'none') throw new Error('only public OAuth clients with token_endpoint_auth_method=none are supported');
  const payload = {
    redirectUris: redirects,
    tokenEndpointAuthMethod: 'none',
    createdAt: Math.floor(Date.now() / 1000),
    nonce: crypto.randomBytes(8).toString('base64url'),
  };
  return seal('dcr_client', payload);
}

export function verifyStatelessClient(clientId, redirectUri) {
  const payload = open('dcr_client', clientId);
  const normalized = normalizeRedirect(redirectUri);
  if (!Array.isArray(payload.redirectUris) || !payload.redirectUris.includes(normalized)) {
    throw new Error('redirect_uri is not registered for this client');
  }
  return payload;
}

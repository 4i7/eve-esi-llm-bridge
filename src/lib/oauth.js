import { openExpiring, sealExpiring, sha256Base64url, timingSafeEqualText } from './crypto.js';
import { refreshEveTokens } from './eve.js';
import { MCP_READ_SCOPE, MCP_WRITE_SCOPE, mcpRefreshTtlSeconds, mcpResource, supportedMcpScopes } from './runtime.js';

export function parseRequestedScopes(raw) {
  const requested = [...new Set(String(raw || MCP_READ_SCOPE).split(/\s+/).filter(Boolean))];
  const supported = new Set(supportedMcpScopes());
  if (!requested.includes(MCP_READ_SCOPE)) requested.unshift(MCP_READ_SCOPE);
  for (const scope of requested) if (!supported.has(scope)) throw new Error(`unsupported scope: ${scope}`);
  return requested;
}

export function verifyPkce(verifier, challenge) {
  if (!verifier || !challenge || !timingSafeEqualText(sha256Base64url(verifier), challenge)) throw new Error('PKCE verification failed');
}

export function issueAuthorizationCode(payload) {
  return sealExpiring('mcp_auth_code', payload, 2 * 60);
}

export function openAuthorizationCode(code) {
  return openExpiring('mcp_auth_code', code);
}

function accessTtl(eveExp) {
  const now = Math.floor(Date.now() / 1000);
  const remaining = Math.max(60, Number(eveExp || now + 600) - now - 15);
  return Math.min(remaining, 15 * 60);
}

export function issueMcpTokenPair({ clientId, resource, scopes, eveAccessToken, eveRefreshToken, identity }) {
  const ttl = accessTtl(identity.exp);
  const accessToken = sealExpiring('mcp_access', {
    clientId,
    resource,
    scopes,
    eveAccessToken,
    characterId: identity.characterId,
    characterName: identity.characterName,
    eveScopes: identity.scopes,
  }, ttl);
  const refreshToken = sealExpiring('mcp_refresh', {
    clientId,
    resource,
    scopes,
    eveRefreshToken,
    characterId: identity.characterId,
    characterName: identity.characterName,
  }, mcpRefreshTtlSeconds());
  return { access_token: accessToken, token_type: 'Bearer', expires_in: ttl, refresh_token: refreshToken, scope: scopes.join(' ') };
}

export function openMcpAccessToken(token, expectedResource) {
  const payload = openExpiring('mcp_access', token);
  if (payload.resource !== expectedResource) throw new Error('MCP token resource mismatch');
  if (!Array.isArray(payload.scopes) || !payload.scopes.includes(MCP_READ_SCOPE)) throw new Error('MCP read scope missing');
  return payload;
}

export async function refreshMcpTokenPair({ refreshToken, clientId, resource }) {
  const stored = openExpiring('mcp_refresh', refreshToken);
  if (stored.clientId !== clientId) throw new Error('refresh token client mismatch');
  if (stored.resource !== resource) throw new Error('refresh token resource mismatch');
  const refreshed = await refreshEveTokens(stored.eveRefreshToken, stored.characterId);
  return issueMcpTokenPair({
    clientId,
    resource,
    scopes: stored.scopes,
    eveAccessToken: refreshed.access_token,
    eveRefreshToken: refreshed.refresh_token,
    identity: refreshed.identity,
  });
}

export function requireWriteScope(authInfo) {
  if (!authInfo?.scopes?.includes(MCP_WRITE_SCOPE)) throw new Error('eve.write MCP scope is required');
}

export function canonicalResource(request) {
  return mcpResource(request);
}

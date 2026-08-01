export const VERSION = '0.1.0';
export const EVE_SSO_METADATA = 'https://login.eveonline.com/.well-known/oauth-authorization-server';
export const ESI_BASE = 'https://esi.evetech.net';
export const MCP_READ_SCOPE = 'eve.read';
export const MCP_WRITE_SCOPE = 'eve.write';

export function publicOrigin(request) {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return new URL(request.url).origin;
}

export function mcpResource(request) {
  return `${publicOrigin(request)}/api/mcp`;
}

export function writeEnabled() {
  return String(process.env.EVE_ENABLE_WRITE_ACTIONS || '').toLowerCase() === 'true';
}

export function supportedMcpScopes() {
  return writeEnabled() ? [MCP_READ_SCOPE, MCP_WRITE_SCOPE] : [MCP_READ_SCOPE];
}

export function requestedEsiScopes() {
  return [...new Set(String(process.env.EVE_ESI_SCOPES || '').split(/\s+/).map((s) => s.trim()).filter(Boolean))];
}

export function compatibilityDate(now = Date.now()) {
  return new Date(now - 11 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function maxEsiPages() {
  const n = Number(process.env.MAX_ESI_PAGES || 50);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 250) : 50;
}

export function userAgent() {
  return process.env.EVE_USER_AGENT?.trim() || `eve-esi-llm-bridge/${VERSION} (self-hosted)`;
}

export function requireEveClientId() {
  const id = process.env.EVE_CLIENT_ID?.trim();
  if (!id) throw new Error('EVE_CLIENT_ID is not configured');
  return id;
}

export function allowedCharacterIds() {
  return new Set(String(process.env.EVE_ALLOWED_CHARACTER_IDS || '')
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isSafeInteger(value) && value > 0));
}

export function assertAllowedCharacter(characterId) {
  const allowed = allowedCharacterIds();
  if (allowed.size && !allowed.has(Number(characterId))) throw new Error('this EVE character is not allowed by deployment policy');
}

export function mcpRefreshTtlSeconds() {
  const days = Number(process.env.MCP_REFRESH_TTL_DAYS || 7);
  const bounded = Number.isFinite(days) && days > 0 ? Math.min(days, 30) : 7;
  return Math.floor(bounded * 24 * 60 * 60);
}

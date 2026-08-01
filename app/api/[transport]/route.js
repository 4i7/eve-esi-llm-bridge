import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import { classifyAction, executeAction, prepareAction } from '../../../src/lib/actions.js';
import { assertPrivateCharacterBinding, esiCall, esiGetAllPages, esiOpenApi, normalizeEsiPath } from '../../../src/lib/eve.js';
import { openMcpAccessToken, requireWriteScope } from '../../../src/lib/oauth.js';
import { MCP_READ_SCOPE, MCP_WRITE_SCOPE, mcpResource, writeEnabled } from '../../../src/lib/runtime.js';

const querySchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean()]))])).optional();

const baseHandler = createMcpHandler(
  (server) => {
    server.registerTool('eve_status', {
      title: 'EVE connection status',
      description: 'Show the EVE character bound to this authenticated MCP connection, granted MCP scopes, granted ESI scopes, and whether write actions are enabled.',
      inputSchema: {},
      securitySchemes: [{ type: 'oauth2', scopes: [MCP_READ_SCOPE] }],
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async (_args, extra) => {
      const ctx = eveContext(extra);
      return result({
        character: { id: ctx.characterId, name: ctx.characterName },
        mcpScopes: extra.authInfo?.scopes || [],
        esiScopes: ctx.eveScopes,
        writeActionsEnabled: writeEnabled(),
      });
    });

    server.registerTool('eve_private_get', {
      title: 'Authenticated ESI GET',
      description: 'Call an authenticated EVE ESI GET endpoint with the connected character token. Character-specific paths are restricted to the connected character. Use current ESI paths without legacy /v1 prefixes.',
      inputSchema: {
        path: z.string().describe('ESI path, for example /characters/123456/assets'),
        query: querySchema,
        all_pages: z.boolean().optional().default(false),
      },
      securitySchemes: [{ type: 'oauth2', scopes: [MCP_READ_SCOPE] }],
      annotations: { readOnlyHint: true, destructiveHint: false },
    }, async ({ path, query = {}, all_pages = false }, extra) => {
      const ctx = eveContext(extra);
      const normalized = normalizeEsiPath(path);
      assertPrivateCharacterBinding(normalized, ctx.characterId);
      const response = all_pages
        ? await esiGetAllPages({ path: normalized, query, accessToken: ctx.eveAccessToken })
        : await esiCall({ method: 'GET', path: normalized, query, accessToken: ctx.eveAccessToken });
      return result(response);
    });

    server.registerTool('eve_public_get', {
      title: 'Public ESI GET',
      description: 'Call a public EVE ESI GET endpoint. Prefer this over web search for official universe, market, kill, jump, faction warfare, type and server data when ESI exposes it.',
      inputSchema: {
        path: z.string(),
        query: querySchema,
        all_pages: z.boolean().optional().default(false),
      },
      securitySchemes: [{ type: 'oauth2', scopes: [MCP_READ_SCOPE] }],
      annotations: { readOnlyHint: true, destructiveHint: false },
    }, async ({ path, query = {}, all_pages = false }) => {
      const normalized = normalizeEsiPath(path);
      const response = all_pages
        ? await esiGetAllPages({ path: normalized, query })
        : await esiCall({ method: 'GET', path: normalized, query });
      return result(response);
    });

    server.registerTool('eve_resolve_ids', {
      title: 'Resolve EVE names to IDs',
      description: 'Use the official ESI /universe/ids resolver for names such as characters, corporations, alliances, systems, stations and inventory types.',
      inputSchema: { names: z.array(z.string()).min(1).max(1000) },
      securitySchemes: [{ type: 'oauth2', scopes: [MCP_READ_SCOPE] }],
      annotations: { readOnlyHint: true, destructiveHint: false },
    }, async ({ names }) => result(await esiCall({ method: 'POST', path: '/universe/ids', body: names })));

    server.registerTool('eve_resolve_names', {
      title: 'Resolve EVE IDs to names',
      description: 'Use the official ESI /universe/names resolver.',
      inputSchema: { ids: z.array(z.number().int().positive()).min(1).max(1000) },
      securitySchemes: [{ type: 'oauth2', scopes: [MCP_READ_SCOPE] }],
      annotations: { readOnlyHint: true, destructiveHint: false },
    }, async ({ ids }) => result(await esiCall({ method: 'POST', path: '/universe/names', body: ids })));


    server.registerTool('eve_character_affiliations', {
      title: 'Resolve character affiliations',
      description: 'Use the official ESI /characters/affiliation resolver for public corporation/alliance/faction affiliation of character IDs.',
      inputSchema: { character_ids: z.array(z.number().int().positive()).min(1).max(1000) },
      securitySchemes: [{ type: 'oauth2', scopes: [MCP_READ_SCOPE] }],
      annotations: { readOnlyHint: true, destructiveHint: false },
    }, async ({ character_ids }) => result(await esiCall({ method: 'POST', path: '/characters/affiliation', body: character_ids })));

    server.registerTool('eve_capabilities', {
      title: 'Discover available ESI capabilities',
      description: 'Compare the current ESI OpenAPI document with the connected character ESI scopes and this bridge policy. Returns routes likely available to this connection; actual ESI responses remain authoritative.',
      inputSchema: { mode: z.enum(['read', 'action', 'all']).optional().default('all') },
      securitySchemes: [{ type: 'oauth2', scopes: [MCP_READ_SCOPE] }],
      annotations: { readOnlyHint: true, destructiveHint: false },
    }, async ({ mode = 'all' }, extra) => {
      const ctx = eveContext(extra);
      const spec = await esiOpenApi();
      const granted = new Set(ctx.eveScopes);
      const rows = [];
      for (const [path, item] of Object.entries(spec.paths || {})) {
        for (const method of ['get', 'post', 'put', 'delete']) {
          const op = item?.[method];
          if (!op) continue;
          const scopes = operationScopes(op);
          if (scopes.length && !scopes.some((s) => granted.has(s))) continue;
          const m = method.toUpperCase();
          const normalized = path.replace(/\{[^}]+\}/g, '0');
          const action = m === 'GET' ? null : classifyAction(m, normalized);
          const rowMode = m === 'GET' || ['/universe/ids', '/universe/names', '/characters/affiliation'].includes(normalized) ? 'read' : action ? 'action' : null;
          if (!rowMode) continue;
          if (rowMode === 'action' && !writeEnabled()) continue;
          if (mode !== 'all' && mode !== rowMode) continue;
          rows.push({ method: m, path, operationId: op.operationId || null, scopes, mode: rowMode, actionName: action?.name || null, risk: action?.risk || null });
        }
      }
      return result({ character: { id: ctx.characterId, name: ctx.characterName }, count: rows.length, capabilities: rows });
    });

    server.registerTool('eve_prepare_action', {
      title: 'Prepare an ESI action',
      description: 'Validate an allowlisted ESI write/UI action and return a short-lived ticket. This tool does not mutate EVE state. The exact ticket must be passed to eve_execute_action to perform the action.',
      inputSchema: {
        method: z.enum(['POST', 'PUT', 'DELETE']),
        path: z.string(),
        query: querySchema,
        body: z.any().optional(),
      },
      securitySchemes: [{ type: 'oauth2', scopes: [MCP_READ_SCOPE, MCP_WRITE_SCOPE] }],
      annotations: { readOnlyHint: true, destructiveHint: false },
    }, async ({ method, path, query = {}, body = null }, extra) => {
      requireWriteScope(extra.authInfo);
      const ctx = eveContext(extra);
      return result(prepareAction({ method, path, query, body, characterId: ctx.characterId }));
    });

    server.registerTool('eve_execute_action', {
      title: 'Execute a prepared ESI action',
      description: 'Execute the exact short-lived action ticket returned by eve_prepare_action. The ticket is bound to the authenticated EVE character and current allowlist.',
      inputSchema: { ticket: z.string().min(20) },
      securitySchemes: [{ type: 'oauth2', scopes: [MCP_READ_SCOPE, MCP_WRITE_SCOPE] }],
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    }, async ({ ticket }, extra) => {
      requireWriteScope(extra.authInfo);
      const ctx = eveContext(extra);
      return result(await executeAction({ ticket, characterId: ctx.characterId, accessToken: ctx.eveAccessToken }));
    });
  },
  { name: 'eve-esi-llm-bridge', version: '0.1.0' },
  { basePath: '/api' },
);

async function verifyToken(request, bearerToken) {
  if (!bearerToken) return undefined;
  try {
    const payload = openMcpAccessToken(bearerToken, mcpResource(request));
    return {
      token: bearerToken,
      scopes: payload.scopes,
      clientId: payload.clientId,
      extra: {
        characterId: payload.characterId,
        characterName: payload.characterName,
        eveScopes: payload.eveScopes,
        eveAccessToken: payload.eveAccessToken,
      },
    };
  } catch {
    return undefined;
  }
}

const authHandler = withMcpAuth(baseHandler, verifyToken, {
  required: true,
  requiredScopes: [MCP_READ_SCOPE],
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };

function eveContext(extra) {
  const ctx = extra.authInfo?.extra;
  if (!ctx?.eveAccessToken || !ctx?.characterId) throw new Error('authenticated EVE context is missing');
  return ctx;
}

function operationScopes(op) {
  const scopes = new Set();
  for (const security of op?.security || []) {
    for (const value of Object.values(security || {})) {
      if (Array.isArray(value)) value.forEach((scope) => typeof scope === 'string' && scope.startsWith('esi-') && scopes.add(scope));
    }
  }
  return [...scopes];
}

function result(value) {
  const response = { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
  if (value && typeof value === 'object' && !Array.isArray(value)) response.structuredContent = value;
  return response;
}

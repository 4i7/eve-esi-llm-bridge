import { randomBase64url, seal, sha256Base64url } from '../../../src/lib/crypto.js';
import { eveMetadata } from '../../../src/lib/eve.js';
import { verifyStatelessClient } from '../../../src/lib/oauth-client.js';
import { parseRequestedScopes } from '../../../src/lib/oauth.js';
import { mcpResource, publicOrigin, requestedEsiScopes, requireEveClientId } from '../../../src/lib/runtime.js';
import { oauthError } from '../../../src/lib/http.js';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const clientId = must(url, 'client_id');
    const redirectUri = must(url, 'redirect_uri');
    const responseType = must(url, 'response_type');
    const codeChallenge = must(url, 'code_challenge');
    const codeChallengeMethod = must(url, 'code_challenge_method');
    const resource = must(url, 'resource');
    const originalState = url.searchParams.get('state') || '';
    if (responseType !== 'code') throw new Error('only response_type=code is supported');
    if (codeChallengeMethod !== 'S256') throw new Error('only PKCE S256 is supported');
    if (resource !== mcpResource(request)) throw new Error('resource does not match this MCP server');
    verifyStatelessClient(clientId, redirectUri);
    const mcpScopes = parseRequestedScopes(url.searchParams.get('scope'));

    const eveState = randomBase64url(24);
    const eveVerifier = randomBase64url(32);
    const transaction = seal('oauth_transaction', {
      eveState,
      eveVerifier,
      clientId,
      redirectUri,
      originalState,
      codeChallenge,
      resource,
      mcpScopes,
      createdAt: Date.now(),
    });

    const metadata = await eveMetadata();
    const origin = publicOrigin(request);
    const authorize = new URL(metadata.authorization_endpoint);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('client_id', requireEveClientId());
    authorize.searchParams.set('redirect_uri', `${origin}/oauth/eve/callback`);
    authorize.searchParams.set('state', eveState);
    authorize.searchParams.set('code_challenge', sha256Base64url(eveVerifier));
    authorize.searchParams.set('code_challenge_method', 'S256');
    const esiScopes = requestedEsiScopes();
    if (esiScopes.length) authorize.searchParams.set('scope', esiScopes.join(' '));

    return new Response(null, {
      status: 302,
      headers: {
        location: authorize.toString(),
        'cache-control': 'no-store',
        'set-cookie': cookie('eve_mcp_tx', transaction, 600),
      },
    });
  } catch (error) {
    return oauthError('invalid_request', error.message);
  }
}

function must(url, key) {
  const value = url.searchParams.get(key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

import { open } from '../../../../src/lib/crypto.js';
import { exchangeEveAuthorizationCode } from '../../../../src/lib/eve.js';
import { issueAuthorizationCode } from '../../../../src/lib/oauth.js';
import { assertAllowedCharacter } from '../../../../src/lib/runtime.js';
import { oauthError } from '../../../../src/lib/http.js';

export async function GET(request) {
  const txToken = readCookie(request, 'eve_mcp_tx');
  let tx = null;
  try {
    if (!txToken) throw new Error('OAuth transaction cookie is missing or expired');
    tx = open('oauth_transaction', txToken);
    if (Date.now() - Number(tx.createdAt || 0) > 10 * 60 * 1000) throw new Error('OAuth transaction expired');

    const url = new URL(request.url);
    const state = url.searchParams.get('state');
    if (!state || state !== tx.eveState) throw new Error('EVE OAuth state mismatch');

    const eveError = url.searchParams.get('error');
    if (eveError) {
      return redirectOuterError(tx, eveError, url.searchParams.get('error_description') || 'EVE authorization was not completed');
    }

    const code = url.searchParams.get('code');
    if (!code) throw new Error('EVE callback is missing authorization code');
    const eve = await exchangeEveAuthorizationCode({ code, codeVerifier: tx.eveVerifier });
    assertAllowedCharacter(eve.identity.characterId);
    const authCode = issueAuthorizationCode({
      clientId: tx.clientId,
      redirectUri: tx.redirectUri,
      codeChallenge: tx.codeChallenge,
      resource: tx.resource,
      scopes: tx.mcpScopes,
      eveAccessToken: eve.access_token,
      eveRefreshToken: eve.refresh_token,
      identity: eve.identity,
    });

    const redirect = new URL(tx.redirectUri);
    redirect.searchParams.set('code', authCode);
    if (tx.originalState) redirect.searchParams.set('state', tx.originalState);
    return redirectResponse(redirect);
  } catch (error) {
    if (tx?.redirectUri) return redirectOuterError(tx, 'access_denied', error.message);
    return oauthError('access_denied', error.message);
  }
}

function redirectOuterError(tx, error, description) {
  const redirect = new URL(tx.redirectUri);
  redirect.searchParams.set('error', error || 'access_denied');
  redirect.searchParams.set('error_description', String(description || 'authorization failed').slice(0, 500));
  if (tx.originalState) redirect.searchParams.set('state', tx.originalState);
  return redirectResponse(redirect);
}

function redirectResponse(url) {
  return new Response(null, {
    status: 302,
    headers: {
      location: url.toString(),
      'cache-control': 'no-store',
      'set-cookie': 'eve_mcp_tx=; Path=/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  });
}

function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

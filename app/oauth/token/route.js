import { formBody, json, oauthError } from '../../../src/lib/http.js';
import { verifyStatelessClient } from '../../../src/lib/oauth-client.js';
import { issueMcpTokenPair, openAuthorizationCode, refreshMcpTokenPair, verifyPkce } from '../../../src/lib/oauth.js';
import { mcpResource } from '../../../src/lib/runtime.js';

export async function POST(request) {
  try {
    const form = await formBody(request);
    const grantType = form.get('grant_type');
    const clientId = required(form, 'client_id');
    const resource = required(form, 'resource');
    if (resource !== mcpResource(request)) throw new Error('resource mismatch');

    let result;
    if (grantType === 'authorization_code') {
      const code = required(form, 'code');
      const redirectUri = required(form, 'redirect_uri');
      const verifier = required(form, 'code_verifier');
      verifyStatelessClient(clientId, redirectUri);
      const authCode = openAuthorizationCode(code);
      if (authCode.clientId !== clientId) throw new Error('authorization code client mismatch');
      if (authCode.redirectUri !== new URL(redirectUri).toString()) throw new Error('authorization code redirect mismatch');
      if (authCode.resource !== resource) throw new Error('authorization code resource mismatch');
      verifyPkce(verifier, authCode.codeChallenge);
      result = issueMcpTokenPair({
        clientId,
        resource,
        scopes: authCode.scopes,
        eveAccessToken: authCode.eveAccessToken,
        eveRefreshToken: authCode.eveRefreshToken,
        identity: authCode.identity,
      });
    } else if (grantType === 'refresh_token') {
      const refreshToken = required(form, 'refresh_token');
      result = await refreshMcpTokenPair({ refreshToken, clientId, resource });
    } else {
      return oauthError('unsupported_grant_type', 'Supported grants: authorization_code, refresh_token');
    }

    return json(result, 200, { pragma: 'no-cache' });
  } catch (error) {
    return oauthError('invalid_grant', error.message);
  }
}

function required(form, key) {
  const value = form.get(key);
  if (!value) throw new Error(`${key} is required`);
  return String(value);
}

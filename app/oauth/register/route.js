import { json, oauthError } from '../../../src/lib/http.js';
import { registerStatelessClient } from '../../../src/lib/oauth-client.js';

export async function POST(request) {
  try {
    const metadata = await request.json();
    const clientId = registerStatelessClient(metadata);
    return json({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: metadata.redirect_uris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }, 201);
  } catch (error) {
    return oauthError('invalid_client_metadata', error.message);
  }
}

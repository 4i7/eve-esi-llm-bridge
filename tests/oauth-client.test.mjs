import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.MCP_AUTH_SECRET = crypto.randomBytes(32).toString('base64url');
const { registerStatelessClient, verifyStatelessClient } = await import('../src/lib/oauth-client.js');

test('stateless DCR client validates registered HTTPS redirect', () => {
  const id = registerStatelessClient({ redirect_uris: ['https://chatgpt.com/connector/oauth/example'], token_endpoint_auth_method: 'none' });
  const data = verifyStatelessClient(id, 'https://chatgpt.com/connector/oauth/example');
  assert.equal(data.tokenEndpointAuthMethod, 'none');
});

test('unregistered redirect is rejected', () => {
  const id = registerStatelessClient({ redirect_uris: ['https://example.com/callback'] });
  assert.throws(() => verifyStatelessClient(id, 'https://evil.example/callback'));
});

test('non-loopback HTTP redirect is rejected', () => {
  assert.throws(() => registerStatelessClient({ redirect_uris: ['http://example.com/callback'] }));
});

test('loopback HTTP redirect is accepted for CLI clients', () => {
  const id = registerStatelessClient({ redirect_uris: ['http://127.0.0.1:12345/callback'] });
  assert.ok(id.startsWith('v1.'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.MCP_AUTH_SECRET = crypto.randomBytes(32).toString('base64url');
const { open, openExpiring, seal, sealExpiring, sha256Base64url } = await import('../src/lib/crypto.js');

test('seal/open round trip', () => {
  const token = seal('demo', { hello: 'world', n: 7 });
  assert.deepEqual(open('demo', token), { hello: 'world', n: 7 });
});

test('kind is authenticated as AAD', () => {
  const token = seal('demo', { hello: 'world' });
  assert.throws(() => open('other', token));
});

test('tampering is rejected', () => {
  const token = seal('demo', { hello: 'world' });
  const mutated = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
  assert.throws(() => open('demo', mutated));
});

test('expiring tokens carry valid timestamps', () => {
  const token = sealExpiring('short', { a: 1 }, 60);
  const opened = openExpiring('short', token);
  assert.equal(opened.a, 1);
  assert.ok(opened.exp > opened.iat);
});

test('PKCE SHA-256 base64url is stable', () => {
  assert.equal(sha256Base64url('abc'), 'ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0');
});

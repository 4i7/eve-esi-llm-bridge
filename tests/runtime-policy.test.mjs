import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedCharacterIds, assertAllowedCharacter, compatibilityDate, mcpRefreshTtlSeconds } from '../src/lib/runtime.js';

test('character allowlist is optional and enforces configured IDs', () => {
  const old = process.env.EVE_ALLOWED_CHARACTER_IDS;
  process.env.EVE_ALLOWED_CHARACTER_IDS = '42, 84';
  assert.deepEqual([...allowedCharacterIds()], [42, 84]);
  assert.doesNotThrow(() => assertAllowedCharacter(42));
  assert.throws(() => assertAllowedCharacter(43));
  if (old === undefined) delete process.env.EVE_ALLOWED_CHARACTER_IDS; else process.env.EVE_ALLOWED_CHARACTER_IDS = old;
});

test('refresh token TTL defaults to seven days and is capped at thirty', () => {
  const old = process.env.MCP_REFRESH_TTL_DAYS;
  delete process.env.MCP_REFRESH_TTL_DAYS;
  assert.equal(mcpRefreshTtlSeconds(), 7 * 86400);
  process.env.MCP_REFRESH_TTL_DAYS = '100';
  assert.equal(mcpRefreshTtlSeconds(), 30 * 86400);
  if (old === undefined) delete process.env.MCP_REFRESH_TTL_DAYS; else process.env.MCP_REFRESH_TTL_DAYS = old;
});

test('ESI compatibility date follows the documented 11:00 UTC boundary', () => {
  assert.equal(compatibilityDate(Date.parse('2026-08-02T10:59:59Z')), '2026-08-01');
  assert.equal(compatibilityDate(Date.parse('2026-08-02T11:00:00Z')), '2026-08-02');
});

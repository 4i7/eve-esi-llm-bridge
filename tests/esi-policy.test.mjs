import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPrivateCharacterBinding, normalizeEsiPath } from '../src/lib/esi-policy.js';
import { classifyAction } from '../src/lib/action-policy.js';

test('ESI path normalization blocks URLs and traversal', () => {
  assert.equal(normalizeEsiPath('/characters/123/assets/'), '/characters/123/assets');
  assert.throws(() => normalizeEsiPath('https://example.com/x'));
  assert.throws(() => normalizeEsiPath('/../secret'));
  assert.throws(() => normalizeEsiPath('/characters\\123'));
});

test('private character route is bound to connected character', () => {
  assert.equal(assertPrivateCharacterBinding('/characters/42/assets', 42), '/characters/42/assets');
  assert.throws(() => assertPrivateCharacterBinding('/characters/43/assets', 42));
});

test('write actions are exact allowlisted route families', () => {
  assert.equal(classifyAction('POST', '/ui/autopilot/waypoint')?.name, 'ui_waypoint');
  assert.equal(classifyAction('POST', '/characters/42/mail')?.name, 'mail_send');
  assert.equal(classifyAction('POST', '/markets/10000002/orders'), null);
});

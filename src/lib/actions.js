import { openExpiring, sealExpiring } from './crypto.js';
import { assertPrivateCharacterBinding, esiCall } from './eve.js';
import { ACTION_RULES, classifyAction } from './action-policy.js';
import { writeEnabled } from './runtime.js';

export function prepareAction({ method, path, query = {}, body = null, characterId }) {
  if (!writeEnabled()) throw new Error('write actions are disabled by deployment policy');
  const rule = classifyAction(method, path);
  if (!rule) throw new Error('action is not allowlisted');
  assertPrivateCharacterBinding(rule.path, characterId);
  const ticket = sealExpiring('action_ticket', {
    characterId,
    method: rule.method,
    path: rule.path,
    query,
    body,
    actionName: rule.name,
    risk: rule.risk,
  }, 10 * 60);
  return { action: { ...rule, query, body }, ticket, expiresInSeconds: 600 };
}

export async function executeAction({ ticket, characterId, accessToken }) {
  if (!writeEnabled()) throw new Error('write actions are disabled by deployment policy');
  const payload = openExpiring('action_ticket', ticket);
  if (Number(payload.characterId) !== Number(characterId)) throw new Error('action ticket character mismatch');
  const currentRule = classifyAction(payload.method, payload.path);
  if (!currentRule || currentRule.name !== payload.actionName) throw new Error('action is no longer allowlisted');
  assertPrivateCharacterBinding(payload.path, characterId);
  const result = await esiCall({ method: payload.method, path: payload.path, query: payload.query, body: payload.body, accessToken });
  return { action: currentRule, result };
}

export function actionRulesForDocumentation() {
  return ACTION_RULES.map(([method, regex, name, risk]) => ({ method, pattern: String(regex), name, risk }));
}

export { classifyAction } from './action-policy.js';

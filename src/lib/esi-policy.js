export function normalizeEsiPath(path) {
  const p = String(path || '').trim();
  if (!p.startsWith('/') || p.includes('://') || p.includes('..') || p.includes('\\')) throw new Error('invalid ESI path');
  const normalized = p.length > 1 ? p.replace(/\/+$/, '') : p;
  if (!/^\/[A-Za-z0-9_{}\-/]+$/.test(normalized)) throw new Error('ESI path contains unsupported characters');
  return normalized;
}

export function assertPrivateCharacterBinding(path, characterId) {
  const normalized = normalizeEsiPath(path);
  const match = /^\/characters\/(\d+)(?:\/|$)/.exec(normalized);
  if (match && Number(match[1]) !== Number(characterId)) throw new Error('private character path targets a different character');
  return normalized;
}

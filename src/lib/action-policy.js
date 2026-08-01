import { normalizeEsiPath } from './esi-policy.js';

export const ACTION_RULES = [
  ['POST', /^\/ui\/autopilot\/waypoint$/, 'ui_waypoint', 'low'],
  ['POST', /^\/ui\/openwindow\/(contract|information|marketdetails|newmail)$/, 'ui_open_window', 'low'],
  ['POST', /^\/characters\/\d+\/fittings$/, 'fitting_create', 'low'],
  ['DELETE', /^\/characters\/\d+\/fittings\/\d+$/, 'fitting_delete', 'destructive'],
  ['POST', /^\/characters\/\d+\/contacts$/, 'contact_add', 'external'],
  ['PUT', /^\/characters\/\d+\/contacts$/, 'contact_update', 'external'],
  ['DELETE', /^\/characters\/\d+\/contacts$/, 'contact_delete', 'destructive'],
  ['POST', /^\/characters\/\d+\/mail$/, 'mail_send', 'external'],
  ['POST', /^\/characters\/\d+\/mail\/labels$/, 'mail_label_create', 'low'],
  ['DELETE', /^\/characters\/\d+\/mail\/labels\/\d+$/, 'mail_label_delete', 'destructive'],
  ['PUT', /^\/characters\/\d+\/mail\/\d+$/, 'mail_update', 'external'],
  ['DELETE', /^\/characters\/\d+\/mail\/\d+$/, 'mail_delete', 'destructive'],
  ['PUT', /^\/characters\/\d+\/calendar\/\d+$/, 'calendar_response', 'external'],
  ['PUT', /^\/fleets\/\d+$/, 'fleet_update', 'external'],
  ['POST', /^\/fleets\/\d+\/members$/, 'fleet_invite', 'external'],
  ['PUT', /^\/fleets\/\d+\/members\/\d+$/, 'fleet_member_move', 'external'],
  ['DELETE', /^\/fleets\/\d+\/members\/\d+$/, 'fleet_member_kick', 'destructive'],
  ['POST', /^\/fleets\/\d+\/wings$/, 'fleet_wing_create', 'external'],
  ['PUT', /^\/fleets\/\d+\/wings\/\d+$/, 'fleet_wing_update', 'external'],
  ['DELETE', /^\/fleets\/\d+\/wings\/\d+$/, 'fleet_wing_delete', 'destructive'],
  ['POST', /^\/fleets\/\d+\/wings\/\d+\/squads$/, 'fleet_squad_create', 'external'],
  ['PUT', /^\/fleets\/\d+\/wings\/\d+\/squads\/\d+$/, 'fleet_squad_update', 'external'],
  ['DELETE', /^\/fleets\/\d+\/wings\/\d+\/squads\/\d+$/, 'fleet_squad_delete', 'destructive'],
];

export function classifyAction(method, path) {
  const m = String(method || '').toUpperCase();
  const p = normalizeEsiPath(path);
  for (const [ruleMethod, regex, name, risk] of ACTION_RULES) {
    if (m === ruleMethod && regex.test(p)) return { method: m, path: p, name, risk };
  }
  return null;
}

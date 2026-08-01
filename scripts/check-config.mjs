const required = ['EVE_CLIENT_ID', 'MCP_AUTH_SECRET'];
let failed = false;
for (const key of required) {
  if (!process.env[key]) {
    console.error(`MISSING ${key}`);
    failed = true;
  } else {
    console.log(`OK ${key}`);
  }
}
if (process.env.MCP_AUTH_SECRET) {
  const bytes = Buffer.from(process.env.MCP_AUTH_SECRET, 'base64url');
  if (bytes.length !== 32) {
    console.error(`INVALID MCP_AUTH_SECRET: expected 32 bytes, got ${bytes.length}`);
    failed = true;
  }
}
const scopes = String(process.env.EVE_ESI_SCOPES || '').split(/\s+/).filter(Boolean);
console.log(`INFO EVE_ESI_SCOPES count=${scopes.length}`);
const allowed = String(process.env.EVE_ALLOWED_CHARACTER_IDS || '').split(/[\s,]+/).filter(Boolean);
console.log(`INFO EVE_ALLOWED_CHARACTER_IDS count=${allowed.length}`);
console.log(`INFO EVE_ENABLE_WRITE_ACTIONS=${String(process.env.EVE_ENABLE_WRITE_ACTIONS || false)}`);
if (failed) process.exit(1);

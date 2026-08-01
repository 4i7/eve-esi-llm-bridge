const raw = process.argv[2];
if (!raw) {
  console.error('Usage: npm run doctor -- https://your-production-domain');
  process.exit(2);
}
const origin = new URL(raw).origin;
let failed = false;

async function check(path, validate) {
  try {
    const response = await fetch(origin + path, { headers: { accept: 'application/json' } });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
    validate?.(data);
    console.log(`OK ${path}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${path}: ${error.message}`);
  }
}

await check('/.well-known/oauth-protected-resource', (data) => {
  if (data.resource !== `${origin}/api/mcp`) throw new Error(`resource=${data.resource}`);
  if (!Array.isArray(data.authorization_servers) || !data.authorization_servers.includes(origin)) throw new Error('authorization_servers does not contain origin');
});
await check('/.well-known/oauth-authorization-server', (data) => {
  if (data.issuer !== origin) throw new Error(`issuer=${data.issuer}`);
  if (data.authorization_endpoint !== `${origin}/oauth/authorize`) throw new Error('wrong authorization endpoint');
  if (data.token_endpoint !== `${origin}/oauth/token`) throw new Error('wrong token endpoint');
  if (data.registration_endpoint !== `${origin}/oauth/register`) throw new Error('wrong registration endpoint');
  if (!data.code_challenge_methods_supported?.includes('S256')) throw new Error('S256 PKCE not advertised');
});

if (failed) process.exit(1);
console.log(`PASS discovery metadata is internally consistent for ${origin}`);

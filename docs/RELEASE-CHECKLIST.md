# Release checklist

For maintainers publishing a source ZIP or public repository.

## Source checks

```bash
npm test
```

When registry access is available:

```bash
npm install
npm run build
```

Run JavaScript syntax checks and inspect all build warnings.

## Privacy / credential checks

Confirm the release has no:

- `.env.local` / `.env.production`;
- `.vercel/` project metadata;
- real EVE Client IDs used as defaults;
- real EVE character IDs used as defaults;
- EVE access/refresh tokens;
- Vercel tokens;
- real `MCP_AUTH_SECRET`;
- maintainer-specific production domains;
- internal knowledge/history files unrelated to the generic bridge.

## Policy checks

- write actions default to false;
- fixed ESI origin remains enforced;
- character binding tests pass;
- action allowlist tests pass;
- OAuth `resource` remains bound to `/api/mcp`;
- DCR redirect URI restrictions remain enforced;
- dependency versions stay above known security-fix floors.

## Documentation checks

- English README is the primary entry point;
- Japanese README remains in sync for the setup path;
- ChatGPT plan notes are checked against current OpenAI Help Center;
- EVE SSO/ESI URLs are current;
- Vercel/Claude setup commands are current;
- write limitations and client-only EVE limitations are explicit.

## Artifact checks

Generate the ZIP from an allowlisted source tree, not from a working directory that might contain secret files.

Generate SHA-256 after the final archive is created and publish both files together.

# Security model

## Scope

This repository is a compact self-hosted reference for one person, a small trusted group, or another controlled deployment. It intentionally avoids a database and external identity-provider dependency by encrypting OAuth state into bearer artifacts.

That tradeoff is appropriate for a personal bridge, but it is not a claim that a small custom OAuth server is the right choice for a public consumer SaaS. OpenAI's current MCP authentication guidance recommends using an established identity provider for broad production deployments. If you expose this service to many unrelated users, replace or substantially harden the authorization-server layer.

## Assets that matter

The primary secrets are:

- `MCP_AUTH_SECRET` — can decrypt/forge bridge tokens if compromised;
- EVE refresh tokens — can obtain new EVE access tokens within granted scopes;
- temporary EVE access tokens;
- outer MCP access/refresh tokens while valid.

The EVE Client ID is a public application identifier, not a secret.

## Credential ownership

A release or public repository must never contain:

- a real EVE refresh token;
- a real EVE access token;
- another person's EVE Client ID presented as the default installation;
- a real `MCP_AUTH_SECRET`;
- private Vercel access/OIDC/bypass tokens;
- hard-coded character IDs from the maintainer's account;
- copied OAuth capsules or action tickets.

Each deployment must create and authorize its own credentials.

## PKCE on both authorization legs

### MCP client → bridge

The outer authorization code requires an `S256` PKCE challenge. The token endpoint recomputes SHA-256 from the verifier and performs a timing-safe comparison.

### Bridge → EVE SSO

The bridge independently generates a second EVE PKCE verifier/challenge and verifies `state` on the callback. This is a separate transaction from the outer MCP PKCE values.

## Token encryption

`src/lib/crypto.js` uses AES-256-GCM with:

- a fresh 96-bit IV for each sealed value;
- a 256-bit random deployment key;
- token-family-specific AAD;
- authentication-tag validation before JSON parsing.

Token kinds are isolated by AAD, for example:

- `dcr_client`;
- `oauth_transaction`;
- `mcp_auth_code`;
- `mcp_access`;
- `mcp_refresh`;
- `action_ticket`.

A token encrypted for one kind fails authentication when opened as another kind.

## Stateless OAuth limitations

The no-database design has deliberate limitations that must be understood. The reference therefore uses 2-minute authorization codes, 15-minute-or-shorter MCP access tokens and a 7-day default outer refresh-token lifetime.

- An encrypted authorization code is short-lived and PKCE-bound, but the bridge does not keep a durable server-side “already redeemed” record. A party that somehow possesses both the code and matching verifier during its short validity window could replay the exchange.
- Outer refresh tokens are rotated by returning a new token, but the bridge cannot maintain a durable per-token revocation list or mark the previous encrypted refresh token as consumed.
- Individual MCP sessions cannot be selectively revoked server-side without adding durable state. Rotation of `MCP_AUTH_SECRET` invalidates all bridge sessions at once; EVE authorization can be revoked separately at EVE.

For a personal/controlled deployment, PKCE, short access/code lifetimes, HTTPS, character allowlisting and secret rotation provide a compact practical boundary. For an internet-scale or high-assurance deployment, use an established authorization server/IdP or add durable transactional state that enforces one-time authorization codes, refresh-token rotation/reuse detection, session revocation, audit and rate limits.

This is also why the project describes its built-in authorization server as a **reference/personal mode**, not a general OAuth platform.

## EVE token validation

Do not trust a JWT merely because it parses.

The code validates:

- cryptographic signature against EVE JWKS;
- accepted EVE issuer;
- audience includes `EVE Online`;
- audience also includes the deployment's own `EVE_CLIENT_ID`;
- expiration;
- subject format `CHARACTER:EVE:<id>`.

The expected character is then propagated into the outer MCP token.

## Outer resource binding

The MCP OAuth flow requires the exact `resource` identifier:

```text
https://YOUR_DOMAIN/api/mcp
```

The resource value is carried into the encrypted MCP tokens and verified on each request. A token issued for a different bridge origin/path is rejected.

Use a stable `PUBLIC_BASE_URL` in production. Changing the production domain invalidates the intended resource identity and normally requires reconnecting clients.

## Dynamic Client Registration boundary

The DCR endpoint accepts public OAuth clients only (`token_endpoint_auth_method=none`). Redirect URIs are stored inside an authenticated encrypted `client_id`.

Redirect restrictions:

- HTTPS is allowed;
- loopback HTTP is allowed for local clients;
- other HTTP is rejected;
- embedded username/password fragments are rejected;
- URL fragments are rejected;
- later authorization/token requests must use an originally registered redirect URI.

For internet-scale use, prefer CIMD or a durable established authorization provider with client-management policy, revocation and abuse controls.

## Deployment access control

A personal Vercel URL is public by default. OAuth prevents another user from gaining *your* EVE authorization, but a stranger could still initiate the service and authenticate their own character, consuming your deployment resources.

For a personal deployment, set:

```text
EVE_ALLOWED_CHARACTER_IDS=123456789
```

Multiple IDs can be comma- or space-separated.

The bridge checks the selected EVE JWT character after SSO. If the allowlist is non-empty and the character is absent, authorization fails.

This is recommended for privately operated instances.

## Fixed-origin ESI calls

The LLM never supplies a full fetch URL. All ESI calls use a fixed CCP origin plus a normalized path. The path rejects URL schemes and traversal.

This matters because a generic “fetch any URL” tool could otherwise be abused for SSRF, cloud metadata access, internal-network probing or credential forwarding.

## Private character boundary

For `/characters/{id}/...` authenticated routes, `{id}` must equal the ID in the validated EVE token.

The check is performed before ESI is called and is repeated for write actions.

## Scope model

There are two scope layers:

### MCP scopes

- `eve.read`
- `eve.write` (only advertised when writes are enabled)

These control what the MCP connection is permitted to request from the bridge.

### ESI scopes

Examples:

- `esi-assets.read_assets.v1`
- `esi-wallet.read_character_wallet.v1`
- `esi-ui.write_waypoint.v1`

These are granted by the EVE user to the user's EVE Developer Application. ESI remains the final authority. The bridge cannot elevate beyond the EVE token's scopes and in-game role permissions.

Do not request “all scopes just in case.” Use the smallest profile that serves the intended workflow.

## Write-action boundary

Writes are disabled by default.

When enabled, `src/lib/action-policy.js` defines the exact method/path families that are allowed. The reference does not provide an “arbitrary authenticated POST” MCP tool.

Current families include selected:

- UI waypoint/open-window operations;
- fitting create/delete;
- contact add/update/delete;
- mail send/label/update/delete;
- calendar response;
- fleet/member/wing/squad management operations.

Risk labels (`low`, `external`, `destructive`) are metadata for policy and explanation. They do not replace product-level approval.

### Prepare → execute

No ESI mutation occurs during prepare. A ticket includes the exact request. Execute accepts only the ticket, not a replacement body supplied by the LLM.

The ticket expires after 10 minutes and is character-bound.

## MCP tool authentication metadata

Tools declare `securitySchemes` so MCP hosts can understand required OAuth scopes. The endpoint is also wrapped with server-side bearer-token verification. Do not rely on client UI labels alone: resource-server enforcement is mandatory.

## Dependency floor

Do not downgrade `mcp-handler` below `1.1.0` or `@modelcontextprotocol/sdk` below `1.26.0`. A 2026 advisory described cross-client state/result leakage in older SDK/handler combinations due transport reuse. The package versions in this reference are intentionally at or above the fixed floor.

Run dependency auditing in your own CI as releases evolve.

## Logging policy

Do not log:

- `Authorization` headers;
- EVE access/refresh tokens;
- MCP access/refresh tokens;
- authorization codes;
- DCR `client_id` ciphertext when avoidable;
- action ticket ciphertext;
- full mail bodies or account data merely for debugging.

Vercel runtime logs may be retained according to your account settings, so treat application logging as a security boundary.

## Error handling

User-visible/tool errors should describe the failure class without returning raw tokens. ESI error payloads may legitimately contain API diagnostics; inspect them before deciding to persist logs.

Authentication failures should not fall back to unauthenticated private requests.

## Secret rotation

### Rotate `MCP_AUTH_SECRET`

1. generate a new 32-byte secret;
2. update Vercel Production environment;
3. redeploy;
4. reconnect MCP clients through OAuth.

All previous sealed DCR client IDs, MCP tokens and action tickets become unusable. Depending on the client, delete/recreate or clear authentication for the MCP connection so it can register again.

### Revoke EVE authorization

Use EVE's account/application authorization controls to revoke access, then reconnect if needed. A revoked EVE refresh token prevents the bridge from refreshing the inner authorization.

## Incident response

If a real secret is ever committed:

1. rotate/revoke it first;
2. remove it from the current tree;
3. purge it from public history when feasible;
4. treat the old value as compromised even if the repository was private temporarily;
5. verify releases and ZIP files too.

Do not “fix” a committed secret by merely adding it to `.gitignore` afterward.

## Release checklist

Before publishing a source archive or repository:

- [ ] `npm test` passes.
- [ ] `npm run build` passes in an environment with dependencies installed.
- [ ] `EVE_ENABLE_WRITE_ACTIONS` remains false in `.env.example`.
- [ ] no `.env.local` or Vercel local files are included.
- [ ] no real character/account identifiers are used as defaults.
- [ ] no token-shaped values from testing are present.
- [ ] no maintainer-specific project domain is embedded.
- [ ] no private repository/history documents are accidentally included.
- [ ] release ZIP is generated from an explicit allowlisted source tree.
- [ ] checksum is generated after the final ZIP.

Suggested local scan:

```bash
grep -RInE \
  'refresh[_ -]?token|access[_ -]?token|client[_ -]?secret|MCP_AUTH_SECRET=.+' \
  . --exclude-dir=.git --exclude='*.md' --exclude='.env.example'
```

Then manually inspect every match. Automated scans can miss secrets and can also produce harmless false positives.

## Trust boundary for LLM output

An LLM's tool argument is not trusted merely because the model generated it. The bridge validates path, character binding, scopes and write allowlist independently.

Likewise, data returned by ESI or later combined with web pages should be treated as data, not executable instructions. A higher-level assistant skill should keep retrieved content separate from system/tool policy to reduce prompt-injection risk.

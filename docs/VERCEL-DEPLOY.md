# Deploy to Vercel

Official Vercel MCP reference: https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel

This project is a normal Next.js application using `mcp-handler`, so Vercel can build it directly from Git.

## 1. Recommended deployment model

Use one Vercel project per independently controlled bridge deployment.

For a personal install:

```text
Your Git repository
      |
      v
Your Vercel project
      |
      +-- your environment variables
      +-- your stable production domain
      +-- your EVE Developer Application callback
```

Do not point multiple unrelated people at a deployment whose secret ownership and administration they do not share.

## 2. Import the repository

In the Vercel dashboard:

1. create/import a new project;
2. select the repository containing this source;
3. keep the framework detected as Next.js;
4. deploy.

The application does not read `EVE_CLIENT_ID` during the compile step, so the initial build can complete before EVE SSO is configured.

## 3. Pick the production origin

After the first deployment, decide which stable origin you will use.

Examples:

```text
https://my-project.vercel.app
https://eve.example.net
```

A custom domain is optional. Stability matters more than the hostname format because OAuth resources and redirect URIs are exact identifiers.

## 4. Register the EVE callback

Once the origin is final, create/configure your EVE Developer Application with:

```text
https://YOUR-PRODUCTION-DOMAIN/oauth/eve/callback
```

See `EVE-DEVELOPER-SETUP.md`.

## 5. Environment variables

Add these to the **Production** environment.

### `EVE_CLIENT_ID` — required

Your own EVE Developer Application Client ID.

### `MCP_AUTH_SECRET` — required

32 random bytes encoded as base64url.

Generate locally:

```bash
npm run secret
```

or use the included offline `tools/generate-secret.html`.

### `PUBLIC_BASE_URL` — strongly recommended

Exact stable production origin:

```text
https://YOUR-PRODUCTION-DOMAIN
```

No trailing slash is required.

Without this value, the server derives its origin from the incoming request. Explicit configuration is safer and clearer for production OAuth resource identity.

### `EVE_ESI_SCOPES`

Space-separated ESI scopes enabled on your EVE Developer Application.

### `EVE_ALLOWED_CHARACTER_IDS` — recommended for personal installs

Comma/space-separated character IDs allowed to complete SSO.

### `EVE_ENABLE_WRITE_ACTIONS`

Keep:

```text
false
```

until you deliberately configure the write path.

### `MAX_ESI_PAGES`

Default sample: `50`. Internal maximum: `250`.

### `MCP_REFRESH_TTL_DAYS`

Default: `7`, maximum accepted by the reference: `30`. Active clients normally receive a new rolling refresh token during refresh. A client left unused beyond the configured lifetime must authorize again. Shorter lifetimes reduce the replay window of a stolen old stateless refresh token.

### `EVE_USER_AGENT`

Optional descriptive User-Agent for ESI calls.

## 6. Redeploy

Environment variable changes do not modify an already built deployment's frozen environment. Trigger a new Production deployment after configuring/changing them.

## 7. Browser checks

Open:

```text
/
/.well-known/oauth-protected-resource
/.well-known/oauth-authorization-server
```

The well-known responses should use your production origin, not a preview URL.

The resource should resolve to:

```text
https://YOUR-PRODUCTION-DOMAIN/api/mcp
```

## 8. MCP endpoint behavior

The MCP route is implemented as:

```text
app/api/[transport]/route.js
```

with `mcp-handler` base path `/api`. Therefore clients use:

```text
https://YOUR-PRODUCTION-DOMAIN/api/mcp
```

The dynamic route also supports the transport paths expected by the adapter.

## 9. Local development

If you want to run locally:

```bash
npm install
cp .env.example .env.local
npm run secret
# paste values into .env.local
npm run dev
```

For EVE SSO, the callback URI in your EVE app must exactly match the origin being used. A localhost callback is useful for development only if configured as such in the EVE app.

A remote MCP client such as ChatGPT Web cannot directly reach localhost. Use a separate trusted tunnel solution for local testing or deploy a preview environment designed for that purpose.

## 10. Preview deployments

Avoid using Vercel's per-commit preview hostname as the persistent OAuth identity for ChatGPT/Claude because:

- the hostname can change;
- `resource` changes;
- EVE callback allowlist would need to change;
- existing MCP tokens are resource-bound to the old URL.

Use production for the normal connection and previews only for controlled development tests.

## 11. Vercel Deployment Protection

If you enable Vercel Authentication/Deployment Protection on the production MCP endpoint, external MCP clients must be able to satisfy that layer *before* they can reach the bridge's OAuth discovery. In many personal setups, that makes the remote MCP client unable to connect.

The bridge's own OAuth is the user-authentication layer. If you add another edge protection layer, verify your chosen MCP client supports it.

## 12. Scaling note

The reference stores no server-side OAuth sessions/database. This works naturally across serverless instances because state travels in authenticated encrypted values.

For public multi-user use, consider adding:

- durable revocation/audit state;
- rate limiting;
- bot/abuse controls;
- an established identity provider;
- explicit tenant boundaries;
- centralized security monitoring.

Those are intentionally outside the personal template.

## 13. Update process

A safe update order is:

1. review dependency/security changes;
2. run tests;
3. deploy without changing `MCP_AUTH_SECRET`;
4. verify well-known endpoints;
5. verify `eve_status` from an existing client;
6. if tool schemas changed, refresh/re-scan tools in the MCP host.

Changing `MCP_AUTH_SECRET` is a credential rotation, not an ordinary code update; expect OAuth clients to re-register/reconnect.

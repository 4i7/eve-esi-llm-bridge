# Troubleshooting

Use this order: **discovery → outer OAuth → EVE SSO → token validation → MCP tool → ESI**. Debugging a later layer before the earlier layer works tends to create misleading fixes.

## 1. Landing page works, MCP client cannot connect

Check:

```text
GET /.well-known/oauth-protected-resource
GET /.well-known/oauth-authorization-server
```

They must be reachable via public HTTPS and must contain the same production origin you configured.

If the metadata contains a preview hostname, set `PUBLIC_BASE_URL` and redeploy.

## 2. `EVE_CLIENT_ID is not configured`

Add the Client ID from **your own** EVE Developer Application to Vercel Production environment and redeploy.

Do not paste an EVE client secret into `EVE_CLIENT_ID`.

## 3. `MCP_AUTH_SECRET is not configured`

Generate a secret:

```bash
npm run secret
```

or use `tools/generate-secret.html` locally.

Add it to Vercel and redeploy.

## 4. `MCP_AUTH_SECRET must decode to exactly 32 bytes`

The value must be base64url encoding of exactly 32 random bytes, not a 32-character human password.

Regenerate it with the included tool.

## 5. OAuth client registration fails

The DCR endpoint accepts public clients and HTTPS redirect URIs (or loopback HTTP for local clients).

Failures may mean:

- client sent no `redirect_uris`;
- redirect is ordinary `http://` on a non-loopback host;
- client requires a different registration/auth method;
- ciphertext from an older `MCP_AUTH_SECRET` is being reused.

After secret rotation, recreate/clear the MCP connection so DCR runs again.

## 6. OAuth `resource mismatch`

The outer OAuth authorization is resource-bound.

Check:

```text
PUBLIC_BASE_URL=https://YOUR-PRODUCTION-DOMAIN
resource=https://YOUR-PRODUCTION-DOMAIN/api/mcp
```

Do not mix preview and production URLs.

## 7. EVE says redirect URI is invalid

Your EVE Developer Application callback must exactly match:

```text
https://YOUR-PRODUCTION-DOMAIN/oauth/eve/callback
```

The ChatGPT/Claude callback is not registered at EVE; only the bridge callback is.

## 8. EVE says scope is invalid / authorization fails before login completes

Compare:

- scopes enabled on the EVE Developer Application;
- `EVE_ESI_SCOPES` spelling.

Remove scopes you do not actually need.

## 9. `EVE OAuth state mismatch`

Possible causes:

- stale/multiple simultaneous auth attempts in the same browser;
- transaction cookie blocked/expired;
- domain changed mid-flow;
- browser privacy/cookie behavior interrupted the callback.

Start a fresh connection/auth flow. Avoid changing domains during authorization.

## 10. `EVE token audience mismatch`

The token was not issued for the Client ID currently configured in the bridge.

Check for:

- wrong `EVE_CLIENT_ID` in Vercel;
- EVE app changed but deployment not updated;
- copied token from another application/deployment.

The correct fix is configuration alignment, not disabling audience validation.

## 11. `this EVE character is not allowed by deployment policy`

The selected character is not in `EVE_ALLOWED_CHARACTER_IDS`.

Select an allowed character or update the deployment allowlist deliberately.

## 12. MCP login succeeds but tool says authenticated EVE context missing

This indicates an outer token/context propagation problem. Clear the MCP client's OAuth state and reconnect. Verify the server is using the current `mcp-handler`/SDK versions.

## 13. ESI private tool returns 401

The EVE access authorization may be invalid/expired/revoked. The outer refresh flow should normally refresh EVE automatically. Clear and reconnect if refresh is no longer valid.

Do not fall back to old cached private values.

## 14. ESI private tool returns 403

Most common reasons:

- token lacks the required ESI scope;
- route requires an in-game corporation/fleet role;
- resource is not visible to this character;
- CCP endpoint-specific authorization rule.

Use `eve_status` and `eve_capabilities`, then inspect the ESI endpoint requirement.

Scope possession does not guarantee role authorization.

## 15. `private character path targets a different character`

The LLM tried a path containing a character ID different from the authenticated EVE JWT.

Resolve/use the authenticated character ID from `eve_status`. Do not remove the binding check.

## 16. ESI path is rejected as invalid

The generic tools accept a path such as:

```text
/characters/123456789/assets
```

They reject:

```text
https://esi.evetech.net/characters/...
../something
\windows\style
```

Pass an ESI path only, not a full URL.

## 17. Public endpoint unexpectedly needs auth

Some ESI endpoints that look “public-ish” still require authentication. Use `eve_private_get` when the ESI OpenAPI route requires a scope.

Conversely, prefer `eve_public_get` when a route is public so the user token is not unnecessarily sent.

## 18. Capability list says route exists, real call still fails

`eve_capabilities` is built from:

- current OpenAPI;
- current token scopes;
- bridge method policy.

It cannot prove a role-gated resource will authorize. Treat the actual ESI response as final.

## 19. Pagination is truncated

Increase `MAX_ESI_PAGES` deliberately, up to the bridge hard maximum of 250. Consider whether the LLM actually needs the entire dataset first.

Large tool responses can also exceed model/client context limits.

## 20. Write tool is missing

Check:

```text
EVE_ENABLE_WRITE_ACTIONS=true
```

and redeploy. If your MCP host uses a frozen tool snapshot, refresh/re-scan the app after enabling write tools.

## 21. `eve.write MCP scope is required`

The current outer OAuth connection was linked while only read was available/requested. Reauthorize after enabling writes.

## 22. `action is not allowlisted`

The method/path is intentionally outside `src/lib/action-policy.js`.

Do not replace this with a generic authenticated POST tool as a convenience. Review the operation and explicitly add a narrowly scoped rule only if you accept the implications.

## 23. `action_ticket token expired`

Prepare again. Tickets last 10 minutes.

Do not extend tickets to days merely to avoid re-preparing a sensitive operation.

## 24. ChatGPT has no Create custom app / MCP UI

This is probably product/plan availability, not a bridge bug. Check the current OpenAI Help Center article for eligible plans/workspaces and Web-only restrictions.

As of 2026-08-02 the cited OpenAI documentation lists full MCP for Business/Enterprise/Edu and read/fetch custom MCP for Pro.

## 25. Claude Code does not open OAuth

Check:

```bash
claude mcp get eve
```

Then use:

```text
/mcp
```

and select the server's authentication action. Confirm the URL was added with `--transport http` and points to `/api/mcp`.

## 26. Build dependency warning about MCP SDK

Do not force an old SDK version. The reference intentionally requires a version above the fixed session-isolation floor.

## 27. Need deeper OAuth debugging

Use MCP Inspector authentication tooling and inspect each stage:

1. resource metadata;
2. authorization-server metadata;
3. DCR response;
4. authorization redirect;
5. EVE callback;
6. outer token exchange;
7. authenticated MCP request.

When using Vercel logs, log event categories and HTTP statuses, not raw secrets.

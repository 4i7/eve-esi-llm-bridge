# Connect the bridge to ChatGPT Web

This page describes the current custom-MCP path documented by OpenAI. Product availability and labels can change, so treat the current OpenAI Help Center as authoritative when the UI differs.

Official references:

- https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt-beta
- https://developers.openai.com/plugins/build/auth

## 1. Plan availability as of 2026-08-02

OpenAI currently documents:

- **Business / Enterprise / Edu:** full custom MCP support, including eligible write/modify actions, through developer mode on ChatGPT Web;
- **Pro:** custom MCP read/fetch connection in developer mode; full MCP write support is not listed for Pro;
- **Plus:** the cited custom-MCP developer-mode article does not list Plus as an eligible custom-MCP tier.

This repository cannot bypass product availability. If your account does not expose the custom app/MCP creation UI, use another MCP client such as Claude Code or Codex, or use an eligible ChatGPT workspace/plan.

## 2. What ChatGPT is authenticating to

ChatGPT is **not** configured as a direct EVE OAuth client.

```text
ChatGPT OAuth client
      |
      v
this bridge OAuth server
      |
      v
EVE SSO
```

This distinction removes a common setup mistake: you do not need to put ChatGPT's OAuth callback URL into your EVE Developer Application.

Your EVE app callback is always:

```text
https://YOUR-PRODUCTION-DOMAIN/oauth/eve/callback
```

The bridge handles ChatGPT's own OAuth redirect separately via DCR.

## 3. Why OAuth is required

OpenAI's current MCP authentication guide expects authenticated MCP servers that expose user-specific data or write actions to implement OAuth 2.1 behavior compatible with the MCP authorization specification. This repository implements the discovery, DCR, resource binding, authorization-code, PKCE, bearer-token and refresh pieces needed by common MCP clients, but its intentionally stateless personal-mode authorization server has weaker replay/revocation semantics than a mature production IdP; see the security limitations below.

The client needs:

- protected-resource metadata;
- authorization-server metadata;
- client identification/registration;
- PKCE;
- resource binding;
- bearer-token verification.

This project exposes those pieces so you do not paste a custom API key or EVE token into ChatGPT.

## 4. Confirm the bridge first

Before opening ChatGPT, verify:

```text
https://YOUR-PRODUCTION-DOMAIN/.well-known/oauth-protected-resource
https://YOUR-PRODUCTION-DOMAIN/.well-known/oauth-authorization-server
```

The protected resource should identify:

```text
https://YOUR-PRODUCTION-DOMAIN/api/mcp
```

If those are wrong, fix `PUBLIC_BASE_URL` and redeploy before creating the ChatGPT app.

## 5. Enable developer mode

For an eligible account/workspace, follow the current OpenAI UI. The Help Center currently describes creating custom apps under Apps settings with developer mode enabled.

Workspace administration differs by plan:

- Business: admin/owner controls developer mode and custom app publishing;
- Enterprise/Edu: developer access and app access can additionally be governed with RBAC;
- Pro: developer mode is required for its supported custom MCP read/fetch path.

## 6. Create the app

In the current flow:

1. open **Settings** or **Workspace Settings**;
2. go to **Apps**;
3. choose **Create**;
4. enter a name such as `My EVE ESI`;
5. enter the MCP endpoint:

   ```text
   https://YOUR-PRODUCTION-DOMAIN/api/mcp
   ```

6. choose OAuth if the UI asks you to choose authentication;
7. choose **Scan tools**.

The bridge advertises DCR, so ChatGPT can register its OAuth client dynamically. You should not need to create a static ChatGPT client secret in this reference implementation.

## 7. Complete EVE SSO

During scan/linking or the first authenticated use, ChatGPT starts the bridge OAuth flow.

The browser is eventually redirected to EVE SSO. Verify the EVE page is on the real EVE login domain, then:

1. sign in to EVE;
2. select the intended character;
3. review the requested ESI scopes;
4. approve only if they match what you configured.

After EVE redirects back to your bridge, the bridge completes the outer OAuth flow and returns control to ChatGPT.

## 8. Test the connection

Create a new chat with the custom app enabled and ask:

```text
Call eve_status and show the EVE character, MCP scopes and ESI scopes bound to this connection.
```

Expected properties:

- the character is the one you selected in EVE SSO;
- `eve.read` is present;
- ESI scopes match the actual token;
- `writeActionsEnabled` is false unless deliberately enabled.

Then test a private read whose scope you know you granted. Example conceptually:

```text
Use the EVE tools to retrieve my current location. Do not guess from conversation history.
```

## 9. Tool scan vs. later server updates

OpenAI documents that MCP tool definitions can be treated as an approved/frozen snapshot. If you later add/change tool definitions, refresh/re-scan the app according to the current workspace UI. Do not assume a deployed code change automatically updates the tools ChatGPT believes are approved.

## 10. Write actions

Only attempt the write path when:

- your ChatGPT plan/workspace currently supports it;
- the EVE app has the corresponding ESI scopes;
- the EVE authorization token includes them;
- `EVE_ENABLE_WRITE_ACTIONS=true`;
- the route is in `src/lib/action-policy.js`;
- the ChatGPT app/workspace permits the action.

A model should call `eve_prepare_action` first, inspect/explain the exact operation, then call `eve_execute_action` with the returned ticket.

ChatGPT may additionally ask for product-level confirmation based on its own action policy. That is independent of the bridge's prepare/execute boundary.

## 11. Reauthorization

Reauthorize when:

- you change ESI scopes;
- you revoke the EVE app;
- you rotate `MCP_AUTH_SECRET`;
- you change the bridge production domain/resource;
- the outer OAuth client state becomes invalid.

After rotating `MCP_AUTH_SECRET`, previous stateless DCR `client_id` values are also invalid. In that case, remove/recreate or fully clear the ChatGPT custom app connection so DCR can run again.

## 12. Common ChatGPT-specific failures

### ChatGPT never shows an OAuth login

Check:

- protected-resource metadata is reachable over HTTPS;
- authorization-server metadata is reachable;
- MCP endpoint returns an authentication challenge when called without a valid token;
- tools advertise OAuth security schemes;
- the ChatGPT plan/workspace supports custom MCP.

### “Invalid client” after secret rotation

The registered DCR `client_id` is encrypted under the old `MCP_AUTH_SECRET`. Recreate the connection so ChatGPT registers again.

### EVE login works but ChatGPT linking fails afterward

Likely outer OAuth mismatch. Check Vercel logs for categories such as:

- `resource mismatch`;
- `authorization code redirect mismatch`;
- PKCE failure;
- expired transaction/code.

Do not log the raw code/token to debug it.

### Scan works but a private ESI tool gets 403

The OAuth bridge is working. Check the ESI scope and any in-game role requirement for that route.

### Tool list is stale

Refresh/re-scan the app in ChatGPT after server tool-definition changes.

## 13. OAuth callback details for advanced operators

OpenAI documents production ChatGPT OAuth callbacks using a URL shaped like:

```text
https://chatgpt.com/connector/oauth/{callback_id}
```

With DCR, ChatGPT supplies that redirect URI to this bridge's `/oauth/register`. The bridge validates and seals it into the generated `client_id`. This is why there is no need to hard-code an OpenAI callback URL in this repository.

## 14. No custom API-key mode

Do not redesign this connector around “paste this secret key into ChatGPT” as a shortcut. OpenAI's current MCP client guidance does not treat arbitrary customer-provided API keys as a replacement for end-user OAuth on this connection path.

That is also the wrong security abstraction for EVE account data: OAuth lets the selected EVE character and permissions remain explicit and revocable.

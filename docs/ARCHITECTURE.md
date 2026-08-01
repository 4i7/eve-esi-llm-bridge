# Architecture

## 1. Goal

The bridge converts EVE Online's official HTTP APIs into a remote MCP tool surface that an LLM client can authenticate to without receiving another user's credentials or sharing a central EVE account.

The design has four distinct roles:

1. **MCP client** — ChatGPT, Claude Code, Codex or another compatible host.
2. **MCP resource + authorization server** — this Vercel deployment.
3. **EVE authorization server** — CCP's EVE SSO.
4. **EVE resource server** — ESI (`https://esi.evetech.net`).

Keeping these roles separate is the most important architectural decision in the project.

## 2. Why there are two OAuth layers

An EVE access token answers a specific question:

> Which EVE character authorized which ESI scopes for this EVE Developer Application?

An MCP access token needs to answer a different question:

> Which identity and scopes does this particular MCP client connection represent, and was the token issued for this MCP resource?

Reusing an EVE token directly as an MCP token would couple two protocols that have different audiences, discovery metadata and lifecycle requirements. The bridge therefore terminates MCP OAuth itself and uses EVE SSO as the user-login/delegated-authorization step behind it.

```text
MCP client
  |
  | 1. discovers /.well-known/oauth-protected-resource
  | 2. discovers /.well-known/oauth-authorization-server
  | 3. DCR registers a public OAuth client
  | 4. starts authorization-code + PKCE
  v
Bridge /oauth/authorize
  |
  | creates its own EVE state + PKCE verifier
  v
EVE SSO
  |
  | user logs in, selects character, approves ESI scopes
  v
Bridge /oauth/eve/callback
  |
  | validates EVE state + JWT
  | creates short-lived MCP authorization code
  v
MCP client callback
  |
  | exchanges code + PKCE verifier at /oauth/token
  v
Bridge issues MCP access + refresh tokens
  |
  | subsequent Authorization: Bearer <MCP token>
  v
/api/mcp -> tools -> ESI
```

## 3. MCP discovery

### Protected resource metadata

`GET /.well-known/oauth-protected-resource`

This advertises:

- the canonical resource: `https://YOUR_DOMAIN/api/mcp`;
- the authorization server: the same Vercel origin;
- supported MCP scopes: `eve.read`, and optionally `eve.write`.

### Authorization server metadata

`GET /.well-known/oauth-authorization-server`

This advertises:

- `/oauth/authorize`;
- `/oauth/token`;
- `/oauth/register` for Dynamic Client Registration (DCR);
- authorization code + refresh token grants;
- PKCE `S256`;
- public-client token endpoint authentication (`none`).

The bridge intentionally implements DCR rather than requiring users to manually copy an OpenAI/Claude OAuth client ID and secret into Vercel.

## 4. Stateless Dynamic Client Registration

A conventional authorization server stores each registered OAuth client in a database. That is unnecessary for a personal reference deployment.

`/oauth/register` validates the client's redirect URIs, then encrypts the resulting client metadata with AES-256-GCM. The ciphertext itself is returned as the `client_id`.

When `/oauth/authorize` or `/oauth/token` later receives that `client_id`, the server decrypts it and verifies that the requested `redirect_uri` was in the original registration.

Allowed redirect forms:

- HTTPS URLs;
- HTTP only for loopback hosts (`localhost`, `127.0.0.1`, `::1`) for local CLI clients.

The sealed `client_id` makes DCR stateless but does **not** make the deployment a general production identity platform. See `SECURITY.md` for scope.

## 5. MCP authorization transaction

When the MCP client calls `/oauth/authorize`, the bridge verifies:

- `response_type=code`;
- registered `client_id` + `redirect_uri` pair;
- PKCE `code_challenge_method=S256`;
- canonical `resource` equals this deployment's `/api/mcp`;
- requested MCP scopes are supported.

It then creates a second, independent PKCE pair for EVE SSO. The pending outer OAuth transaction is encrypted in an HttpOnly/Secure/SameSite cookie. The cookie contains no plaintext refresh token.

## 6. EVE SSO PKCE leg

The bridge discovers current EVE OAuth endpoints from:

```text
https://login.eveonline.com/.well-known/oauth-authorization-server
```

The browser is redirected to EVE SSO with:

- your deployment's own `EVE_CLIENT_ID`;
- `redirect_uri=https://YOUR_DOMAIN/oauth/eve/callback`;
- requested ESI scopes;
- random `state`;
- PKCE `code_challenge` using `S256`.

The callback exchanges the authorization code using:

- `grant_type=authorization_code`;
- the code;
- your EVE Client ID;
- the matching PKCE verifier.

The PKCE flow does not require the EVE client secret.

## 7. EVE JWT validation

The EVE access token is treated as untrusted until validated.

`src/lib/eve.js`:

1. reads EVE's current OAuth metadata;
2. obtains JWKS URI;
3. verifies JWT signature with `jose`;
4. accepts the EVE issuer forms documented by CCP;
5. requires the audience to include both your `EVE_CLIENT_ID` and `EVE Online`;
6. checks expiry;
7. requires subject format `CHARACTER:EVE:<numeric-id>`;
8. extracts character name and granted scopes.

If `EVE_ALLOWED_CHARACTER_IDS` is configured, the selected character must also be present in that local deployment allowlist.

## 8. Outer MCP tokens

The bridge does not return the raw EVE token as the OAuth access token. It seals a separate MCP token containing the minimum state needed by the MCP resource server:

```text
MCP access token (short lived)
  clientId
  resource
  MCP scopes
  current EVE access token
  EVE character id/name
  granted ESI scopes

MCP refresh token (longer lived)
  clientId
  resource
  MCP scopes
  EVE refresh token
  character identity
```

Both are opaque AES-GCM ciphertext to the client.

The MCP access-token lifetime is capped at 15 minutes and never deliberately outlives the embedded EVE access token. Authorization codes expire after 2 minutes. Outer refresh tokens default to a 7-day rolling lifetime (configurable up to 30 days).

When the MCP client uses the outer refresh token, `/oauth/token` refreshes the inner EVE authorization first, validates that the character identity did not change, accepts a rotated EVE refresh token if CCP returns one, then issues a new outer token pair.

## 8.1 Stateless authorization tradeoff

Because the reference does not provision a database, it cannot maintain a durable per-code/per-refresh-token consumed/revoked set. The encrypted authorization code is very short-lived and PKCE-bound, but one-time redemption is not persisted. Likewise, rotating an outer refresh token does not make the previous ciphertext globally unredeemable until its own expiry.

That tradeoff is intentional for a copyable personal example and is documented rather than hidden. A public multi-user production service should use a mature authorization server or durable state to enforce single-use codes, refresh rotation/reuse detection and selective revocation.

## 9. Why AES-GCM and a deployment secret

AES-GCM provides authenticated encryption: modification of ciphertext or authenticated metadata causes decryption to fail. Different token families use different Additional Authenticated Data (AAD) labels, so a DCR client token cannot be replayed as an MCP access token or action ticket.

The key is exactly 32 random bytes in base64url form (`MCP_AUTH_SECRET`). It is never generated from a human password or source-code constant.

The reference is stateless because all state is encrypted into short-lived bearer artifacts. A database-backed design may be preferable when you need revocation lists, shared multi-instance administration, audit history, many users, or organization policies.

## 10. MCP tool layer

`app/api/[transport]/route.js` uses Vercel's `mcp-handler` adapter.

The main tools are:

| Tool | Purpose |
|---|---|
| `eve_status` | Show current authenticated EVE identity/scopes |
| `eve_private_get` | Authenticated ESI GET; binds character paths |
| `eve_public_get` | Public ESI GET without bearer token |
| `eve_resolve_ids` | `/universe/ids` resolver |
| `eve_resolve_names` | `/universe/names` resolver |
| `eve_character_affiliations` | `/characters/affiliation` resolver |
| `eve_capabilities` | Compare current OpenAPI + granted scopes + bridge policy |
| `eve_prepare_action` | Validate and seal a write action |
| `eve_execute_action` | Revalidate and execute the sealed action |

Every tool is declared with MCP OAuth security metadata. The entire MCP endpoint is additionally protected by bearer-token verification.

## 11. ESI request boundary

Tool inputs never contain an arbitrary origin. `src/lib/eve.js` always builds URLs from:

```text
https://esi.evetech.net + normalizedPath
```

The path normalizer rejects:

- values not beginning with `/`;
- `://`;
- `..` traversal;
- backslashes;
- unsupported path characters.

This is why the generic tools can remain flexible without becoming arbitrary HTTP tools.

## 12. Character-specific binding

For authenticated paths matching:

```text
/characters/<id>/...
```

`<id>` must equal the character ID from the EVE JWT. The LLM cannot ask a token for character A to call a private character-B route simply by changing an input integer.

This does not artificially bind corporation/fleet routes to a character ID because ESI itself performs role and membership authorization on those routes.

## 13. ESI compatibility-date handling

Each ESI request sends `X-Compatibility-Date`. CCP documents that the API day changes at 11:00 UTC, so the implementation calculates the date using `now - 11 hours` before taking the UTC calendar date.

This prevents a clock-time window where simply using the local/current UTC date would accidentally advertise a compatibility date that ESI considers future relative to its API day.

## 14. Pagination

`eve_private_get` and `eve_public_get` can optionally request all pages. The bridge reads `X-Pages` from the first ESI response and iterates pages up to `MAX_ESI_PAGES`, which is capped at 250 internally.

This protects the function from unbounded pagination. When the endpoint advertises more pages than the configured cap, metadata reports truncation.

## 15. Dynamic capability discovery

`eve_capabilities` reads ESI's current OpenAPI document and compares:

```text
current ESI routes
+ scopes required by each operation
+ scopes in current EVE token
+ bridge method policy
+ write allowlist
= visible capability inventory
```

This is intentionally an aid, not an authorization oracle. The actual ESI response remains authoritative because role requirements, resource visibility, endpoint state and CCP changes may still make a route fail.

## 16. Write-action architecture

Writes are disabled unless `EVE_ENABLE_WRITE_ACTIONS=true`.

Even then, an operation must match an exact method/path family in `src/lib/action-policy.js`.

`eve_prepare_action`:

1. checks global write policy;
2. normalizes method/path;
3. requires allowlist match;
4. applies private-character binding;
5. seals method/path/query/body/action class/risk/character into a 10-minute ticket.

`eve_execute_action`:

1. checks write policy again;
2. decrypts and verifies ticket age/authenticity;
3. verifies character identity matches current connection;
4. re-runs the current allowlist classification;
5. re-runs character binding;
6. sends the exact ESI request;
7. returns actual ESI response metadata.

This prevents the model from preparing one action and silently substituting a different path/body at execution time.

## 17. What the bridge deliberately does not solve

This project does not attempt to:

- store gameplay memory or strategy history;
- scrape EVE UI state;
- automate the EVE client;
- bypass EVE SSO/ESI permission checks;
- turn arbitrary HTTP APIs into MCP tools;
- infer client-only facts from unrelated system statistics;
- provide an internet-scale identity service;
- replace confirmation/approval behavior in the LLM product.

A separate skill or knowledge repository can build policy and gameplay reasoning on top of this clean live-data plane.

## 18. Source-priority pattern for an EVE assistant

A useful skill should route evidence in this order:

```text
Current account-visible fact?  -> authenticated ESI
Official public game fact?     -> public ESI
Client-only current fact?      -> screenshot/log/user evidence
Historical measured result?    -> observation store / own logs
Patch/meta/community gap?       -> current web/third-party source
Still unresolved?              -> inference, explicitly labeled
```

That evidence model is intentionally kept outside the OAuth implementation so the bridge remains reusable.

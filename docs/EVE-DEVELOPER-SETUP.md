# EVE Developer Application setup

This page configures **your own** EVE SSO/ESI application. Never reuse credentials copied from another person's deployment.

Official reference: https://developers.eveonline.com/docs/services/sso/

## 1. Why an EVE Developer Application is required

ESI has public endpoints and authenticated endpoints. Authenticated endpoints require EVE SSO, and EVE SSO needs an application identity (`client_id`) with a registered callback URL and permitted scopes.

The EVE application belongs to the operator of the bridge. The player later authorizes a specific EVE character to that application.

## 2. Deploy first so you know the callback URL

The callback is derived from your stable production origin:

```text
https://YOUR-PRODUCTION-DOMAIN/oauth/eve/callback
```

Example only:

```text
https://example-eve-bridge.vercel.app/oauth/eve/callback
```

Use your real production hostname. A Vercel preview hostname changes across deployments and is therefore a poor OAuth callback identity.

## 3. Create the application

Open the EVE Developers Portal:

https://developers.eveonline.com/

Create a third-party application and configure:

- a recognizable application name;
- the exact callback URL shown above;
- only the ESI scopes you intend to use.

After creation, copy the Client ID into Vercel as:

```text
EVE_CLIENT_ID=...
```

## 4. Why the client secret is not configured

EVE documents an Authorization Code with PKCE flow. In that flow, the token exchange uses:

```text
grant_type=authorization_code
code=<authorization code>
client_id=<your client id>
code_verifier=<your verifier>
```

The PKCE example explicitly does not use the client secret. This repository follows that flow so the deployment does not need an EVE client-secret environment variable.

This does **not** mean client secrets are generally unimportant. It means this particular OAuth flow was selected to avoid requiring one.

## 5. Choose scopes deliberately

The bridge can only request scopes enabled on your EVE application. The EVE user must then approve the requested scopes during SSO.

The `.env.example` starter is read-oriented. You can reduce it further.

Typical examples:

| Goal | ESI scope |
|---|---|
| Current location | `esi-location.read_location.v1` |
| Current ship type | `esi-location.read_ship_type.v1` |
| Online state | `esi-location.read_online.v1` |
| Trained skills | `esi-skills.read_skills.v1` |
| Skill queue | `esi-skills.read_skillqueue.v1` |
| Wallet | `esi-wallet.read_character_wallet.v1` |
| Assets | `esi-assets.read_assets.v1` |
| Loyalty points | `esi-characters.read_loyalty.v1` |
| Standings | `esi-characters.read_standings.v1` |
| Saved fittings | `esi-fittings.read_fittings.v1` |
| Personal market orders | `esi-markets.read_character_orders.v1` |
| Clones | `esi-clones.read_clones.v1` |
| Implants | `esi-clones.read_implants.v1` |

See [ESI-SCOPES.md](ESI-SCOPES.md) for profiles and write scope notes.

## 6. Match the environment variable to the portal

`EVE_ESI_SCOPES` is a space-separated list. Every requested scope should also be enabled on the application in the EVE Developer Portal.

If your environment asks EVE SSO for a scope not permitted for the app, authorization can fail.

Example:

```text
EVE_ESI_SCOPES="esi-location.read_location.v1 esi-location.read_ship_type.v1 esi-skills.read_skills.v1"
```

## 7. Character allowlist

For a personal deployment, set:

```text
EVE_ALLOWED_CHARACTER_IDS=123456789
```

or multiple values:

```text
EVE_ALLOWED_CHARACTER_IDS="123456789,987654321"
```

This is separate from EVE SSO scopes. It is a local deployment policy saying which characters are allowed to finish the bridge authorization flow.

If you do not know your character ID yet, you can temporarily leave the value empty, complete one controlled login, obtain the ID through `eve_status`, then add it to Vercel and redeploy. Clear/reconnect the MCP OAuth session afterward if necessary.

## 8. What the user sees during EVE SSO

When the MCP client needs authentication:

1. the bridge redirects the browser to EVE SSO;
2. the player logs into EVE's own site;
3. the player selects a character;
4. EVE shows the scopes being requested;
5. the player approves or cancels;
6. EVE redirects to the callback on the player's own bridge.

The bridge never needs the user's EVE account password.

## 9. Refresh token lifecycle

EVE returns a refresh token after successful authorization. It is long-lived and must be protected.

This reference does not write it to source code or tool output. It is carried inside the bridge's encrypted MCP refresh token. When the outer MCP client refreshes its authorization, the bridge uses the embedded EVE refresh token to obtain a fresh EVE access token.

If EVE returns a rotated refresh token, the newly issued MCP refresh token contains the new value.

## 10. JWT validation checks

After each EVE token exchange/refresh, the bridge validates the EVE access JWT before using it.

It checks:

- signature from EVE JWKS;
- issuer;
- audience contains `EVE Online`;
- audience contains your exact EVE Client ID;
- expiration;
- subject format `CHARACTER:EVE:<id>`.

Never remove these checks just because the token came directly from a token endpoint. They defend the resource side against token mixups and wrong-client tokens.

## 11. Changing scopes later

If you add an ESI scope:

1. add/enable it in the EVE Developer Portal;
2. add it to `EVE_ESI_SCOPES` in Vercel;
3. redeploy;
4. reauthorize the MCP connection through EVE SSO so the new permission is actually granted.

A refresh token issued under an older authorization should not be assumed to magically acquire new permissions.

## 12. Removing scopes

Remove the scope from the environment and, if desired, from the developer application. Reauthorize so the resulting token clearly reflects the reduced permission set.

For least privilege, removing unused scopes is preferable to leaving broad dormant authorization.

## 13. Common EVE setup failures

### Redirect URI mismatch

Symptom: EVE rejects the authorization redirect.

Check the exact production URL including scheme, hostname, path and trailing slash behavior. The expected path is:

```text
/oauth/eve/callback
```

### Invalid scope

Check the EVE Developer Portal and `EVE_ESI_SCOPES` spelling.

### Audience mismatch

The access token must have been issued for the same Client ID configured in `EVE_CLIENT_ID`. This often indicates environment/configuration drift.

### Character rejected by bridge

Check `EVE_ALLOWED_CHARACTER_IDS`.

### Refresh stops working

The EVE authorization may have been revoked, the app configuration may have changed, or the token may otherwise be invalid. Clear the MCP client's authentication and complete EVE SSO again.

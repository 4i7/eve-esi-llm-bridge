# Implementation notes and glossary

This document explains terms used by the code without assuming prior OAuth/MCP specialization.

## MCP — Model Context Protocol

MCP is a protocol for exposing tools/resources to AI applications in a common format. Instead of writing a separate proprietary integration for every LLM product, a service can expose an MCP server and compatible clients can discover/call its tools.

In this project, MCP is the interface between the LLM host and the EVE bridge.

## ESI — EVE Swagger Interface

ESI is EVE Online's official REST API. It contains both public endpoints and authenticated endpoints.

Examples:

- public: universe data, many market/system endpoints;
- authenticated: character wallet, skills, assets, location, etc., depending on scopes.

ESI is not equivalent to the running EVE game client.

## EVE SSO — Single Sign-On

EVE SSO is CCP's OAuth service. It authenticates the EVE user, lets the user select a character and asks the user to consent to ESI scopes.

The bridge does not collect the user's EVE password.

## OAuth

OAuth is an authorization protocol for letting one application act with limited permissions on behalf of a user without giving the application the user's password.

Important roles here:

- Authorization server: issues tokens after user approval.
- Resource server: accepts tokens and serves protected operations.
- Client: asks for authorization and later calls the resource server.

This repository participates in two OAuth relationships: outer MCP OAuth and inner EVE SSO OAuth.

## Access token

A token used on normal protected requests. Access tokens should generally be short-lived.

The bridge has two different access tokens in play:

- EVE access token — issued by EVE SSO for ESI;
- MCP access token — issued by this bridge for `/api/mcp`.

They are not interchangeable.

## Refresh token

A longer-lived credential used to obtain a new access token without requiring the user to log in again immediately.

The EVE refresh token is sensitive because it can mint new EVE access tokens within the granted permissions until revoked/invalidated.

## Scope

A named permission.

Examples:

```text
eve.read                         MCP scope
esi-wallet.read_character_wallet.v1   ESI scope
```

Scope names belong to their own authorization layer.

## PKCE — Proof Key for Code Exchange

PKCE protects OAuth authorization codes against interception/replay.

The client creates a random `code_verifier`, hashes it into a `code_challenge`, and sends the challenge during authorization. Later it must present the original verifier during token exchange.

This project requires the SHA-256 method (`S256`).

## State

An OAuth `state` value is a random value used to correlate the browser redirect with the transaction that initiated it and defend against request-forgery/mixup problems.

The bridge has separate outer OAuth state and EVE SSO state.

## JWT — JSON Web Token

EVE access tokens are JWTs. A JWT has signed claims such as issuer, audience, expiry and subject.

Parsing a JWT is not the same as validating it. The bridge verifies the cryptographic signature and required claims.

## JWKS — JSON Web Key Set

A published set of public keys used to verify JWT signatures. EVE's OAuth metadata points to the current JWKS URL.

The code discovers and caches it instead of hard-coding a signing key.

## Issuer (`iss`)

Identifies who issued a token. The bridge checks the EVE issuer against the forms CCP documents.

## Audience (`aud`)

Identifies what the token is intended for.

For EVE JWT validation, the bridge expects both the configured EVE Client ID and `EVE Online` according to CCP's documented token shape.

For outer MCP authorization, the project additionally binds its own opaque token to the canonical MCP `resource`.

## Subject (`sub`)

The identity represented by a token. EVE uses:

```text
CHARACTER:EVE:<character-id>
```

The bridge derives the character ID from the validated subject rather than taking it from an LLM argument.

## OAuth protected resource metadata

An RFC 9728-style discovery document describing the MCP resource and the authorization server(s) that can issue tokens for it.

This project exposes:

```text
/.well-known/oauth-protected-resource
```

## OAuth authorization server metadata

Discovery information telling a client where to authorize, exchange tokens and register a client.

This project exposes:

```text
/.well-known/oauth-authorization-server
```

## DCR — Dynamic Client Registration

An OAuth client can register itself automatically instead of a human manually creating a client record.

ChatGPT and other MCP clients may use DCR. This bridge supports a stateless form: validated metadata is AES-GCM sealed into the returned `client_id`.

## CIMD — Client ID Metadata Documents

A newer/preferred MCP client-identification option in which a client can use a stable HTTPS metadata document as its client identity.

This reference implements DCR because it is simple and compatible with multiple clients. A large production authorization service may prefer CIMD and stronger client authentication.

## Resource parameter

MCP OAuth uses a `resource` value to bind authorization to the intended MCP server.

Here the canonical resource is:

```text
https://YOUR_DOMAIN/api/mcp
```

The value is checked throughout the outer OAuth lifecycle.

## Bearer token

A credential where possession is sufficient to use it. Because bearer tokens can be replayed by whoever obtains them, they must be protected in transit/storage and kept short-lived where possible.

## AES-256-GCM

An authenticated encryption mode. It encrypts the payload and produces an authentication tag so tampering is detected.

The bridge uses AES-GCM for compact stateless OAuth artifacts.

## IV / nonce

A per-encryption random value. GCM requires IV uniqueness under the same key; the implementation uses a fresh cryptographic random 12-byte IV each time.

## AAD — Additional Authenticated Data

Data authenticated by AES-GCM but not encrypted as part of the payload. The bridge uses token-kind/version labels as AAD so ciphertext for one purpose cannot be interpreted as another token type.

## SSRF — Server-Side Request Forgery

A vulnerability where user input causes a server to fetch attacker-chosen URLs, possibly including internal cloud/network endpoints.

The ESI tools accept only normalized ESI paths and always use CCP's fixed ESI origin, specifically to avoid becoming an arbitrary fetch proxy.

## Allowlist

A list/pattern set of operations explicitly allowed. The write path uses method + path regex entries in `src/lib/action-policy.js`.

Anything not matching is rejected even if the EVE token has a broad scope.

## Prepare/execute ticket

A bridge-specific safety pattern:

- prepare validates an exact mutation request and encrypts it;
- execute can perform only the mutation encoded in the still-valid ticket.

This reduces the chance that the target/action changes between planning and execution.

## ESI Compatibility Date

ESI versions behavior using `X-Compatibility-Date`. CCP documents that the API day changes at 11:00 UTC.

`compatibilityDate()` therefore uses `now - 11 hours` before deriving `YYYY-MM-DD`.

## ESI error limit

ESI responses can carry headers describing error-budget remaining/reset. An assistant should not hammer a failing endpoint repeatedly.

## Vercel Function

Server-side code that runs on Vercel in response to HTTP requests. Next.js route handlers compile into functions as appropriate.

The bridge is stateless across function invocations by design.

## `mcp-handler`

Vercel's adapter package that hosts an MCP server through Next.js/Nuxt HTTP routes.

This repository pins a modern floor because older MCP SDK/handler combinations had a published session-isolation vulnerability.

## `jose`

A JavaScript library for JWT/JWS/JWK/JWKS operations. It is used to validate EVE JWTs against remote JWKS.

## Zod

Schema validation library used by the MCP SDK to describe and validate tool arguments.

## Tool annotation

Metadata such as read-only/destructive/idempotent hints helps MCP hosts understand tool behavior. It is descriptive and does not replace server-side authorization.

## Public vs private ESI tool

### `eve_public_get`

Does not send the user's EVE bearer token.

### `eve_private_get`

Sends the validated current EVE access token and applies character-path binding.

Use the public tool when authentication is unnecessary.

## Why the project does not store tokens in a database

The target is a copyable personal reference. Stateless encrypted artifacts reduce initial operational requirements.

Tradeoffs:

Benefits:

- no DB provisioning;
- easy serverless scaling;
- release ZIP is self-contained;
- no central store of refresh tokens on disk/database.

Costs:

- coarse revocation: rotate secret or revoke EVE authorization;
- no server-side token/session inventory;
- no durable audit trail;
- DCR administration is limited;
- not ideal for many-tenant SaaS.

Those tradeoffs should be reconsidered if your usage grows beyond personal/controlled deployment.

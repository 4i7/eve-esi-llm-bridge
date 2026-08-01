# Security Policy

This repository is a self-hosted reference implementation. For the threat model, token design, deployment controls and release checklist, read [`docs/SECURITY.md`](docs/SECURITY.md).

## Reporting a vulnerability

If you publish a fork, configure a private security-reporting channel appropriate to your repository rather than asking reporters to post exploitable details in a public issue.

## Credential disclosure

Do not submit real EVE access tokens, EVE refresh tokens, `MCP_AUTH_SECRET`, Vercel tokens, private OAuth codes or other reusable secrets in issues, pull requests or logs.

If a credential is disclosed, revoke/rotate it before discussing remediation.

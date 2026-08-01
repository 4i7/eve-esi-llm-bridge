# Claude Code and other MCP clients

## Claude Code

Anthropic documents remote HTTP MCP servers with:

```bash
claude mcp add --transport http <name> <url>
```

For this bridge:

```bash
claude mcp add --transport http eve https://YOUR-PRODUCTION-DOMAIN/api/mcp
```

Then start Claude Code:

```bash
claude
```

Inside the interactive session:

```text
/mcp
```

Select/authenticate the `eve` server. Claude Code supports OAuth for remote HTTP MCP servers and should open a browser login flow.

Official Anthropic reference:

https://docs.anthropic.com/en/docs/claude-code/mcp

## What you should see

The browser flow is:

```text
Claude Code -> bridge OAuth -> EVE SSO -> bridge -> Claude Code
```

After successful login:

```text
Use the EVE MCP server and call eve_status.
```

## Suggested scope when adding the server

Claude Code's `--scope` option controls where its MCP configuration is stored.

For a private personal endpoint, a user-scoped configuration may be convenient:

```bash
claude mcp add --scope user --transport http eve https://YOUR-PRODUCTION-DOMAIN/api/mcp
```

For a team/project configuration, do not accidentally commit private bearer tokens. Claude's OAuth credentials are managed separately from the server URL configuration.

## Clear/reconnect authentication

If you rotate `MCP_AUTH_SECRET`, change domains or modify OAuth configuration, use Claude Code's `/mcp` authentication management to clear the old authorization and reconnect.

Because this reference uses stateless DCR, rotating the bridge encryption key invalidates the old registered `client_id` as well as issued tokens.

## Codex and other MCP clients

The server uses standard remote MCP over HTTP plus OAuth discovery. A compatible client needs to support:

- Streamable HTTP MCP;
- OAuth protected-resource discovery;
- OAuth authorization-code flow with PKCE;
- either Dynamic Client Registration compatible with the advertised endpoint or another supported client-registration path.

If a client only supports static bearer headers and cannot run OAuth discovery, this reference is intentionally not optimized for it. Do not work around that by publishing a long-lived EVE refresh token in a header/config file.

## Generic MCP configuration concept

For clients using a JSON MCP configuration, the conceptual server entry is:

```json
{
  "mcpServers": {
    "eve": {
      "url": "https://YOUR-PRODUCTION-DOMAIN/api/mcp"
    }
  }
}
```

The exact key names differ between products. Let the product run the OAuth flow rather than adding an EVE token manually.

## MCP Inspector

For protocol debugging, use the Model Context Protocol Inspector and its authentication controls to walk through discovery, registration, authorization and token exchange.

Use it before changing security code based on guesswork.

Official MCP documentation:

https://modelcontextprotocol.io/

## Client compatibility checklist

A client is a good fit if it can:

- reach a public HTTPS endpoint;
- discover OAuth metadata;
- register/identify itself;
- launch a browser authorization flow;
- persist and refresh OAuth tokens;
- send `Authorization: Bearer ...` on MCP requests;
- respect the advertised MCP tool schemas.

## Do not share one person's login

Even when several LLM clients point to the same personal bridge, each OAuth connection should authorize through EVE SSO. Do not copy an encrypted MCP refresh token from one product to another as a manual shortcut.

For a multi-user organization, add proper tenant/account controls rather than sharing one character token.

# Contributing

Keep this project generic and credential-independent.

## Requirements for changes

- Never commit real EVE/Vercel/MCP credentials or character-specific private data.
- Preserve fixed-origin ESI routing and private-character binding.
- Do not add a generic arbitrary authenticated write tool.
- New mutations must be narrow entries in `src/lib/action-policy.js` with an explicit risk class.
- Preserve prepare → execute for write actions.
- Keep `.env.example` write-disabled.
- Add/update tests for security-boundary changes.
- Update English and Japanese setup docs when user-facing setup changes.
- Prefer official EVE/OpenAI/Anthropic/Vercel/MCP documentation for protocol requirements.

Run:

```bash
npm test
npm run build
```

before release when dependencies are available.

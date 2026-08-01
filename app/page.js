export default function Home() {
  return (
    <main>
      <h1>EVE ESI LLM Bridge</h1>
      <p>This deployment exposes an authenticated MCP endpoint backed by EVE Online SSO and ESI.</p>
      <ul>
        <li>MCP endpoint: <code>/api/mcp</code></li>
        <li>OAuth protected-resource metadata: <code>/.well-known/oauth-protected-resource</code></li>
        <li>OAuth authorization-server metadata: <code>/.well-known/oauth-authorization-server</code></li>
      </ul>
      <p>No EVE credentials are stored in this page or repository. Each deployment uses its owner&apos;s EVE Developer Application and each connection is authorized by the player through EVE SSO.</p>
    </main>
  );
}

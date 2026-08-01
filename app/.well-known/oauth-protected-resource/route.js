import { json } from '../../../src/lib/http.js';
import { mcpResource, publicOrigin, supportedMcpScopes } from '../../../src/lib/runtime.js';

export async function GET(request) {
  return json({
    resource: mcpResource(request),
    authorization_servers: [publicOrigin(request)],
    scopes_supported: supportedMcpScopes(),
    bearer_methods_supported: ['header'],
    resource_documentation: `${publicOrigin(request)}/`,
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' } });
}

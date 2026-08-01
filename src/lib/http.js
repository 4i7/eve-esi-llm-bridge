export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function oauthError(code, description, status = 400) {
  return json({ error: code, error_description: description }, status);
}

export async function formBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/x-www-form-urlencoded')) throw new Error('expected application/x-www-form-urlencoded');
  return new URLSearchParams(await request.text());
}

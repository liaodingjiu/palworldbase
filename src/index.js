export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response;
    try {
      response = await env.ASSETS.fetch(request);
    } catch (e) {
      return serve404(request, env);
    }
    if (response.status >= 400) {
      return serve404(request, env);
    }
    return response;
  }
};

async function serve404(request, env) {
  try {
    const notFound = await env.ASSETS.fetch(new Request(new URL('/404.html', request.url)));
    if (notFound.ok) {
      return new Response(notFound.body, {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
  } catch (e) {
    // fall through to fallback
  }
  return new Response('404 Not Found', { status: 404 });
}

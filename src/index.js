export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const response = await env.ASSETS.fetch(request);
    if (response.status >= 400) {
      // Try to serve custom 404.html from assets
      try {
        const notFoundUrl = new URL('/404.html', request.url);
        const notFoundRequest = new Request(notFoundUrl, request);
        const notFound = await env.ASSETS.fetch(notFoundRequest);
        if (notFound.ok) {
          return new Response(notFound.body, {
            status: 404,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
        }
      } catch (e) {
        // ASSETS fetch failed, fall through
      }
      // Hard fallback — proves Worker code is running
      return new Response(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>404 - Page Not Found</title><style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#111;color:#eee;}</style></head><body><div style="text-align:center"><h1 style="font-size:4rem;margin:0">404</h1><p>Page not found</p><a href="/" style="color:#4af">← Back to PalworldBase</a></div></body></html>',
        { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }
    return response;
  }
};

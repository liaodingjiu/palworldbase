export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status === 404) {
      const notFound = await env.ASSETS.fetch(new Request(new URL('/404.html', request.url)));
      if (notFound.ok) {
        return new Response(notFound.body, {
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
    }
    return response;
  }
};

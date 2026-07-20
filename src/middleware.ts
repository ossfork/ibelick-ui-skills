import { defineMiddleware } from "astro:middleware";

const securityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self' https://api.interfaceoffice.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const withSecurityHeaders = (response: Response) => {
  const securedResponse = new Response(response.body, response);
  Object.entries(securityHeaders).forEach(([key, value]) =>
    securedResponse.headers.set(key, value),
  );
  return securedResponse;
};

export const onRequest = defineMiddleware((context, next) => {
  const url = new URL(context.request.url);

  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
    const status =
      context.request.method === "GET" || context.request.method === "HEAD"
        ? 301
        : 308;

    return withSecurityHeaders(Response.redirect(url, status));
  }

  return next().then((response) => {
    return response ? withSecurityHeaders(response) : response;
  }) as Promise<Response>;
});

// BUILD_TRIGGER: explicit-upstream-error-2026-11-21
// SAGI VOICE EDGE RELAY
// Overseas-only relay template for Cloudflare Workers / workers.dev.
// No SAGI domestic server or custom domain is required.
const ORIGIN = "https://sagi-cloud-bridge-suny820916.onrender.com";

const ALLOWED_CLIENT_ORIGINS = new Set([
  "https://suny820916.github.io",
  "https://sagisports.cn",
  "https://www.sagisports.cn"
]);

function cors(origin) {
  const allow = ALLOWED_CLIENT_ORIGINS.has(origin) ? origin : "https://suny820916.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "false",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    // Limit relay surface to SAGI Cloud endpoints only.
    if (!(url.pathname === "/health" || url.pathname.startsWith("/api/"))) {
      return new Response("Not found", { status: 404, headers: cors(origin) });
    }

    const upstream = new URL(url.pathname + url.search, ORIGIN);
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("cf-connecting-ip");
    headers.delete("x-forwarded-for");
    headers.set("X-SAGI-Edge-Relay", "1");

    headers.delete("content-length");
    const init = {
      method: request.method,
      headers,
      redirect: "follow"
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      // Buffer small/medium API bodies before forwarding. This avoids
      // Safari/Workers ReadableStream forwarding failures that surface as
      // a generic "Load failed" in iOS fetch().
      init.body = await request.arrayBuffer();
    }

    let response;
    try {
      response = await fetch(upstream, init);
    } catch (err) {
      const h = new Headers(cors(origin));
      h.set("Content-Type", "application/json; charset=utf-8");
      h.set("X-SAGI-Relay", "workers.dev");
      return new Response(JSON.stringify({
        ok: false,
        error: "SAGI_EDGE_UPSTREAM_FAILED",
        detail: String(err && err.message ? err.message : err)
      }), { status: 502, headers: h });
    }
    const outHeaders = new Headers(response.headers);
    for (const [k,v] of Object.entries(cors(origin))) outHeaders.set(k,v);
    outHeaders.set("X-SAGI-Relay", "workers.dev");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders
    });
  }
};

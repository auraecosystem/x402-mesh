/**
 * Agent-Readiness fixes for tinkrr-api.tinkrr.workers.dev
 * ---------------------------------------------------------
 * Drop these pieces into your existing Cloudflare Worker. They're written
 * as standalone, composable functions so you can wire them into whatever
 * router you're already using (plain fetch switch, Hono, itty-router, etc).
 *
 * Covers, in priority order:
 *   1. Markdown content negotiation      (Content, weight 4, FAIL)
 *   2. Single <h1> + meta description +  (Quality,  weight 3+2+2, FAIL)
 *      OpenGraph tags
 *   3. JSON-LD (Organization/WebSite/    (Quality/Commerce, weight 3+3, FAIL)
 *      Offer)
 *   4. /sitemap.xml + robots.txt Sitemap (Discoverability, weight 3, FAIL)
 *      line
 *   5. /llms.txt with linked sub-docs    (Content, weight 3, WARN)
 *   6. /.well-known/api-catalog          (Capabilities, weight 3, WARN)
 *   7. AI-bot rules in robots.txt        (Access Control, weight 2, WARN)
 *   8. <link rel="canonical">            (Quality, weight 2, WARN)
 *
 * Adjust SITE_CONFIG below to match your real routes, product data, and
 * page content, then wire the handlers into your router.
 */

// ---------------------------------------------------------------------------
// 0. Central config — edit this to match your actual site
// ---------------------------------------------------------------------------
const SITE_CONFIG = {
  origin: "https://tinkrr-api.tinkrr.workers.dev",
  siteName: "Tinkrr",
  orgName: "Tinkrr",
  orgLogo: "https://tinkrr-api.tinkrr.workers.dev/logo.png",
  defaultDescription:
    "Tinkrr API — describe what your product actually does in 120-160 characters.",
  defaultOgImage: "https://tinkrr-api.tinkrr.workers.dev/og-image.png",
  // If you sell something, fill this in — powers JSON-LD Offer + /pricing.
  offer: {
    name: "Tinkrr subscription",
    priceCurrency: "USD",
    price: "0.00", // set real price
    availability: "https://schema.org/InStock",
    url: "https://tinkrr-api.tinkrr.workers.dev/pricing",
  },
  // Every indexable page needs an entry here: path -> { title, description, markdown }
  pages: {
    "/": {
      title: "Tinkrr",
      description:
        "Tinkrr API — describe what your product actually does in 120-160 characters.",
      // Plain-text/markdown source of the page. This is what gets served
      // when a client asks for text/markdown, and also feeds the rendered
      // HTML body so the two never drift out of sync.
      markdown: `# Tinkrr

Tinkrr is ... (replace with your real homepage copy).

## What it does
- Point one
- Point two

## Get started
See [/docs](/docs) or [/pricing](/pricing).
`,
    },
    // Add more routes here as you build out sitemap/llms.txt coverage.
  },
};

// ---------------------------------------------------------------------------
// 1. Markdown content negotiation
// ---------------------------------------------------------------------------
// Call this at the top of your fetch handler for any page route. If the
// client prefers text/markdown (agents/LLM tools increasingly send this),
// return the raw markdown instead of paying HTML-render + parse cost.
function wantsMarkdown(request) {
  const accept = request.headers.get("Accept") || "";
  return accept.includes("text/markdown");
}

function markdownResponse(pageConfig) {
  return new Response(pageConfig.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

// ---------------------------------------------------------------------------
// 2 + 3. HTML head: single H1, meta description, OpenGraph, canonical,
//         JSON-LD (Organization + WebSite + optional Offer)
// ---------------------------------------------------------------------------
function renderJsonLd(path, pageConfig) {
  const graphs = [
    {
      "@type": "Organization",
      name: SITE_CONFIG.orgName,
      url: SITE_CONFIG.origin,
      logo: SITE_CONFIG.orgLogo,
    },
    {
      "@type": "WebSite",
      name: SITE_CONFIG.siteName,
      url: SITE_CONFIG.origin,
    },
  ];

  // Only emit an Offer block on pages where it makes sense (e.g. "/", "/pricing").
  if (SITE_CONFIG.offer && (path === "/" || path === "/pricing")) {
    graphs.push({
      "@type": "Product",
      name: SITE_CONFIG.offer.name,
      offers: {
        "@type": "Offer",
        price: SITE_CONFIG.offer.price,
        priceCurrency: SITE_CONFIG.offer.priceCurrency,
        availability: SITE_CONFIG.offer.availability,
        url: SITE_CONFIG.offer.url,
      },
    });
  }

  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graphs,
  })}</script>`;
}

function renderHead(path, pageConfig) {
  const canonicalUrl = SITE_CONFIG.origin + path;
  const description = pageConfig.description || SITE_CONFIG.defaultDescription;
  const title = pageConfig.title || SITE_CONFIG.siteName;

  return `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonicalUrl}" />

    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${SITE_CONFIG.defaultOgImage}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="website" />

    <!-- RFC 8288 Link headers are set separately (see withDiscoveryHeaders) -->
    ${renderJsonLd(path, pageConfig)}
  `;
}

function renderPageHtml(path, pageConfig) {
  // Minimal, dependency-free markdown -> HTML for the body so the H1 comes
  // straight from your markdown source (keeps content + SEO markup in sync).
  const bodyHtml = simpleMarkdownToHtml(pageConfig.markdown);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${renderHead(path, pageConfig)}
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Very small markdown->HTML converter covering just what's needed for a
// clean single-H1 body (headings, paragraphs, links, lists). Swap in a real
// markdown lib if you need more.
function simpleMarkdownToHtml(md) {
  const lines = md.trim().split("\n");
  let html = "";
  let h1Used = false;
  let inList = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      continue;
    }
    if (line.startsWith("# ")) {
      // Only ever emit ONE <h1> per page — demote any further "# " to h2.
      const tag = h1Used ? "h2" : "h1";
      h1Used = true;
      html += `<${tag}>${inlineMd(line.slice(2))}</${tag}>`;
    } else if (line.startsWith("## ")) {
      html += `<h2>${inlineMd(line.slice(3))}</h2>`;
    } else if (line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inlineMd(line.slice(2))}</li>`;
    } else {
      html += `<p>${inlineMd(line)}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function inlineMd(text) {
  return escapeHtml(text).replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, label, href) => `<a href="${href}">${label}</a>`
  );
}

// ---------------------------------------------------------------------------
// 4. Sitemap + robots.txt Sitemap line
// ---------------------------------------------------------------------------
function renderSitemapXml() {
  const now = new Date().toISOString();
  const urls = Object.keys(SITE_CONFIG.pages)
    .map(
      (path) => `
  <url>
    <loc>${SITE_CONFIG.origin}${path}</loc>
    <lastmod>${now}</lastmod>
  </url>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;
}

function renderRobotsTxt() {
  // Item 7: explicit AI-bot rules instead of falling back to your generic
  // policy. Adjust allow/disallow per bot as you actually intend.
  return `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: CCBot
Allow: /

Sitemap: ${SITE_CONFIG.origin}/sitemap.xml
`;
}

// ---------------------------------------------------------------------------
// 5. llms.txt with linked sub-docs
// ---------------------------------------------------------------------------
function renderLlmsTxt() {
  // Per llmstxt.org: a one-line description, then links to markdown docs
  // agents can fetch individually instead of scraping HTML.
  return `# ${SITE_CONFIG.siteName}

> ${SITE_CONFIG.defaultDescription}

## Docs
- [Homepage](${SITE_CONFIG.origin}/) — overview and getting started
- [API Reference](${SITE_CONFIG.origin}/openapi.json) — OpenAPI spec
- [Pricing](${SITE_CONFIG.origin}/pricing) — plans and pricing
`;
}

// ---------------------------------------------------------------------------
// 6. /.well-known/api-catalog (RFC 9727)
// ---------------------------------------------------------------------------
function renderApiCatalog() {
  return {
    "linkset": [
      {
        anchor: SITE_CONFIG.origin,
        "service-desc": [
          {
            href: `${SITE_CONFIG.origin}/openapi.json`,
            title: "Tinkrr API — OpenAPI 3.0 spec",
            type: "application/json",
          },
        ],
        "mcp-server": [
          {
            href: `${SITE_CONFIG.origin}/.well-known/mcp/server-card.json`,
            title: "Tinkrr MCP server card",
            type: "application/json",
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 7 (header form). RFC 8288 Link header — attach to every HTML response.
// ---------------------------------------------------------------------------
function withDiscoveryHeaders(response) {
  const links = [
    `<${SITE_CONFIG.origin}/openapi.json>; rel="service-desc"`,
    `<${SITE_CONFIG.origin}/.well-known/api-catalog>; rel="api-catalog"`,
    `<${SITE_CONFIG.origin}/.well-known/mcp/server-card.json>; rel="mcp-server"`,
  ].join(", ");
  const headers = new Headers(response.headers);
  headers.set("Link", links);
  return new Response(response.body, { status: response.status, headers });
}

// ---------------------------------------------------------------------------
// Wiring it all together in a fetch handler
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/robots.txt") {
      return new Response(renderRobotsTxt(), {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (path === "/sitemap.xml") {
      return new Response(renderSitemapXml(), {
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      });
    }

    if (path === "/llms.txt") {
      return new Response(renderLlmsTxt(), {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (path === "/.well-known/api-catalog") {
      return new Response(JSON.stringify(renderApiCatalog(), null, 2), {
        headers: { "Content-Type": "application/linkset+json" },
      });
    }

    // Any configured content page: markdown negotiation + HTML render.
    const pageConfig = SITE_CONFIG.pages[path];
    if (pageConfig) {
      if (wantsMarkdown(request)) {
        return markdownResponse(pageConfig);
      }
      const html = renderPageHtml(path, pageConfig);
      const response = new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
      return withDiscoveryHeaders(response);
    }

    // ... fall through to your existing routes (API, MCP, x402, etc.)
    return new Response("Not found", { status: 404 });
  },
};

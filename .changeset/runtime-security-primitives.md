---
'@objectstack/runtime': minor
---

Add production HTTP hardening primitives. `createDispatcherPlugin` now
sends conservative security response headers by default
(CSP / X-Content-Type-Options / X-Frame-Options / Referrer-Policy /
Permissions-Policy / Cross-Origin-Resource-Policy). HSTS is opt-in.

Caller can disable with `securityHeaders: false` (e.g., when an upstream
reverse proxy already injects them) or customize per-header via
`SecurityHeadersOptions`.

Also exports a standalone token-bucket `RateLimiter` with a pluggable
`RateLimitStore` interface (in-memory default; trivially backed by
Redis) and curated `DEFAULT_RATE_LIMITS` for auth / write / read buckets.
The limiter is NOT auto-wired into the dispatcher — adapter-layer
wire-up (Fastify / Hono / Express) is recommended for proper IP/key
extraction; see `docs/HARDENING.md` for recipes.

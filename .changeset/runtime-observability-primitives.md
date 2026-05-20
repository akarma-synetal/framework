---
'@objectstack/runtime': minor
---

Add production observability primitives. `createDispatcherPlugin` now
exposes an `observability` config that auto-instruments every mounted
route with:

- Request-id propagation: `X-Request-Id` echo + `req.requestId` (honors
  incoming header when well-formed, mints `req_<uuid>` otherwise).
- `http_requests_total{method,route,status}` counter.
- `http_request_duration_ms{method,route}` histogram.
- `http_request_errors_total{method,route}` counter.
- Error reporter call for 5xx (4xx are intentionally tracked via
  metrics only, not reported, to keep APM signal:noise high).

All defaults are no-op (zero overhead). Hosts plug their own
`MetricsRegistry` (Prometheus / OTel) and `ErrorReporter` (Sentry /
Datadog) — see `docs/OBSERVABILITY.md` for adapter recipes and the
go-live checklist.

Standalone primitives also exported for adapter-layer use:
`extractRequestId`, `resolveRequestId`, `parseTraceparent`,
`formatTraceparent`, `InMemoryMetricsRegistry`,
`InMemoryErrorReporter`, `instrumentRouteHandler`.

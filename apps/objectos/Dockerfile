# syntax=docker/dockerfile:1.7
#
# ObjectOS — production container image
# --------------------------------------------------
# Build context = repo root (Dockerfile expects the full pnpm workspace):
#
#   docker buildx build --platform linux/amd64 \
#     -f apps/objectos/Dockerfile \
#     -t objectos:latest .
#
# Stage 1 (`builder`) installs the full dev tree and builds every workspace
# package apps/objectos transitively depends on.
#
# Stage 2 (`pruner`) uses `pnpm deploy --prod` to extract a self-contained
# tree under /deploy that contains only production deps (workspace packages
# are flattened to plain `node_modules/@objectstack/*` entries).
#
# Stage 3 (`runner`) starts from a clean slim base and only COPYs /deploy,
# yielding an image that is ~3× smaller than `COPY --from=builder /repo /app`.

# ──────────────────────────────────────────────────────────────────────────
# Stage 1 — install workspace deps + build required packages
# ──────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

# native bindings for better-sqlite3 and friends
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json tsup.config.ts ./
COPY packages ./packages
COPY examples ./examples
COPY apps/objectos ./apps/objectos

RUN pnpm install --frozen-lockfile --prod=false

# Build apps/objectos + all its workspace transitive deps.
RUN pnpm --filter '@objectstack/objectos...' build

# ──────────────────────────────────────────────────────────────────────────
# Stage 2 — production prune (pnpm deploy)
# ──────────────────────────────────────────────────────────────────────────
# Creates a /deploy tree containing apps/objectos with its full prod
# dependency graph, devDependencies stripped, workspace packages
# materialised as real folders under node_modules/. Source `src/`, tests,
# and `.map` files inside the workspace package dists are kept (they are
# tiny next to node_modules); strip more aggressively if you need to.
FROM builder AS pruner
WORKDIR /repo
RUN pnpm --filter @objectstack/objectos deploy --prod --legacy /deploy \
  && find /deploy -type f \( -name "*.map" -o -name "*.test.*" -o -name "*.spec.*" -o -name "*.md" -o -name "*.markdown" \) -delete \
  && find /deploy -type d \( -name "__tests__" -o -name "test" -o -name "tests" -o -name "docs" -o -name "example" -o -name "examples" \) -prune -exec rm -rf {} + \
  && rm -rf /deploy/.turbo /deploy/.cache \
  # Surgical removal of dev-only deps that get pulled in by package peers
  # but are NOT used by the ObjectOS runtime path (verified by smoke test).
  && rm -rf \
       /deploy/node_modules/.pnpm/next@* \
       /deploy/node_modules/.pnpm/@next+* \
       /deploy/node_modules/.pnpm/playwright-core@* \
       /deploy/node_modules/.pnpm/@playwright+* \
       /deploy/node_modules/.pnpm/typescript@* \
       /deploy/node_modules/.pnpm/happy-dom@* \
       /deploy/node_modules/.pnpm/@rolldown+* \
       /deploy/node_modules/.pnpm/@img+sharp-libvips-* \
       /deploy/node_modules/.pnpm/@cloudflare+workers-types@* \
       /deploy/node_modules/.pnpm/@esbuild+* \
       /deploy/node_modules/.pnpm/lightningcss-* \
       /deploy/node_modules/.pnpm/caniuse-lite@*

# ──────────────────────────────────────────────────────────────────────────
# Stage 3 — slim runtime image
# ──────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=pruner /deploy /app
COPY --from=builder /repo/apps/objectos/dist /app/dist

EXPOSE 3000
VOLUME ["/data"]

# The container talks to the control plane (local SQLite at /data or remote
# libSQL/Turso) via env. The local file path is only viable on platforms
# with a persistent volume mount (Fly volumes, Docker volumes) — on
# Cloudflare Containers it MUST be overridden to a remote URL.
ENV OS_DATABASE_URL=file:/data/control.db

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null 2>&1 || exit 1

# Invoke the CLI binary directly — no pnpm process needed at runtime.
CMD ["node", "node_modules/@objectstack/cli/bin/run.js", "serve", "dist/objectstack.config.js", "--prebuilt"]

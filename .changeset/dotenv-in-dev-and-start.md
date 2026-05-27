---
'@objectstack/cli': patch
---

`os dev` and `os start` now load `.env` files via dotenv-flow, matching
the existing `os serve` behavior. Previously only `serve` honored
`.env` / `.env.development` / `.env.production` / `.env.local`, which
made env-based configuration (e.g. `OS_DATABASE_URL`) silently inert
for the two most commonly used commands and surprised users who set up
the conventional `.env.*` layout.

Loading order (later wins): `.env`, `.env.${NODE_ENV}`, `.env.local`,
`.env.${NODE_ENV}.local`. `os dev` pins NODE_ENV to `development`; `os
start` defaults to `production`. Process env still wins over file
values, so CLI flags and shell exports remain authoritative.

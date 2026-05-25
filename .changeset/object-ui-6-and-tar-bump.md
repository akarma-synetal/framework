---
'@objectstack/cli': minor
'@objectstack/account': minor
'create-objectstack': patch
---

Upgrade `@object-ui/*` packages to **v6.0**.

- `@objectstack/cli`: `@object-ui/console` and `@object-ui/studio` from `^5.4.2` → `^6.0.0` — bundled Studio + Console assets now ship the v6 UI shell (new design language, refreshed sidebar, redesigned record header).
- `@objectstack/account`: `@object-ui/i18n` from `^5.4.2` → `^6.0.0` — i18n runtime now matches the v6 console/studio API.
- Root devDependency `@object-ui/console` from `^5.4.2` → `^6.0.0` so workspace scripts and the docs build pick up v6.
- `create-objectstack`: `tar` from `^7.4.3` → `^7.5.15` (security + perf fixes when unpacking remote templates).

**Heads-up for consumers:** `@object-ui/*` v6 is a major release of the bundled UI; pages rendered through the CLI's `studio` / `console` mounts may look different from v5. The protocol surface is unchanged.


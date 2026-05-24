---
'@objectstack/driver-sqlite-wasm': major
---

Sync `@objectstack/driver-sqlite-wasm` into the v6 fixed-version group so it
releases in lockstep with the rest of the framework. The package was
previously stuck at 5.2.1 on npm while every other `@objectstack/*` package
moved to 6.0.0, which broke StackBlitz/WebContainer installs of templates
that pin `^6.0.0`.

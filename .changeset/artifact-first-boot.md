---
"@objectstack/runtime": minor
"@objectstack/cli": minor
---

Artifact-first boot: `objectstack start` (and `objectstack serve`) now boot directly from a compiled `dist/objectstack.json` when no `objectstack.config.ts` is present.

- `@objectstack/runtime` exports `createDefaultHostConfig()` and `resolveDefaultArtifactPath()` — a standalone-only default host that wraps `createStandaloneStack()` and surfaces the artifact's `requires` / `objects` / `manifest`. No dependency on `@objectstack/service-cloud`.
- `objectstack start` accepts `OS_ARTIFACT_PATH` as a file path **or** an `http(s)://` URL. New flags `--artifact`, `--database`, `--database-driver`, `--database-auth-token`, `--auth-secret`, `--project-id`, `--port` let you specify all runtime conditions on the command line (each overrides the matching env var).
- `objectstack dev` accepts the same runtime-override flags. When `--artifact` is supplied, the auto-compile step is skipped and the dev server boots the supplied artifact directly — no `objectstack.config.ts` required in cwd.
- `objectstack start` no longer mounts Studio / Account / Console by default — those are dev/admin surfaces. Pass `--ui` to opt back in.
- `objectstack serve` falls back to the default host config when the config file is missing but an artifact is resolvable.
- `apps/objectos` (cloud / multi-project) is unchanged.


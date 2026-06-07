# ObjectStack Skills

Domain-scoped instructions for AI coding assistants (Claude Code, Copilot, Cursor)
working in the ObjectStack monorepo. Each skill is self-contained: a `SKILL.md`
with YAML frontmatter, plus a `references/_index.md` that points into the
authoritative Zod sources in `node_modules/@objectstack/spec/src/...`.

> **Always read the spec source for exact field shapes.** Skills give shape and
> intent; the Zod schemas are the truth.

---

## Index

| Skill | Use when you are… |
|:------|:------------------|
| [objectstack-platform](./objectstack-platform/SKILL.md) | Bootstrapping or operating a runtime — `defineStack`, drivers, adapters, plugins, services, CLI, deploy. |
| [objectstack-data](./objectstack-data/SKILL.md) | Modelling objects, fields, field conditional rules, relationships, validations, indexes, lifecycle hooks, permissions / RLS, or seed datasets. |
| [objectstack-query](./objectstack-query/SKILL.md) | Writing ObjectQL — filters, sorting, pagination, aggregation, joins, window functions, full-text search. |
| [objectstack-ui](./objectstack-ui/SKILL.md) | Designing Views, Apps, Pages, Dashboards, dataset-bound widgets, Reports, Charts, or Actions. |
| [objectstack-automation](./objectstack-automation/SKILL.md) | Wiring Flows, Workflows, Triggers, Approvals, scheduled jobs, or webhooks. |
| [objectstack-ai](./objectstack-ai/SKILL.md) | Designing Agents, Tools, Skills, Conversations, Model Registry entries, or MCP integrations. |
| [objectstack-api](./objectstack-api/SKILL.md) | Exposing server-side API surface — REST/GraphQL endpoints, auth, realtime, error envelopes. |
| [objectstack-i18n](./objectstack-i18n/SKILL.md) | Authoring translation bundles, configuring locale fallback, or reading coverage reports. |
| [objectstack-formula](./objectstack-formula/SKILL.md) | Writing CEL expressions — formula fields, field rules, predicates (validation / sharing / visibility), conditions, dynamic seed values. |

---

## Skill anatomy

```
skills/<skill-name>/
├── SKILL.md              # frontmatter + prose guide
└── references/
    └── _index.md         # pointers into @objectstack/spec sources
```

`SKILL.md` frontmatter fields:

| Field | Purpose |
|:------|:--------|
| `name` | Stable id (matches directory name). |
| `description` | One paragraph — what the skill is for *and* what it is **not** for. |
| `license` | `Apache-2.0`. |
| `compatibility` | Minimum `@objectstack/spec` version. |
| `metadata.domain` | One of: `platform`, `data`, `query`, `ui`, `automation`, `ai`, `api`, `i18n`, `formula`. |
| `metadata.tags` | Short comma-separated keywords for retrieval. |

---

## Conventions enforced across skills

- **Zod first.** Never invent types — read `node_modules/@objectstack/spec/src/**/*.zod.ts`.
- **Short object names** (`account`, `task`); no `namespace`, no `tableName`.
- **CEL for all expressions** — predicates, conditions, schedules. Use the
  `F\`\``, `P\`\``, `cel\`\``, `cron\`\``, `tmpl\`\`` tagged templates from
  `@objectstack/spec`. Legacy `OLD` / `NEW` evaluate to `null` since M9.5.
- **v5.0 vocabulary** — runtime workspace is `environment`, not `project`.
- **Singular metadata type names** (`agent`, `view`, `flow`, …); REST resource
  collections are plural (`/api/v1/ai/agents`).

---

## Cross-skill routing

A few common decision points where the right skill isn't obvious:

- **Lifecycle hooks on data vs. business automation** — object-level hooks
  (`beforeInsert`, etc.) live in **objectstack-data**; cross-record orchestration,
  approvals, and scheduled work live in **objectstack-automation**.
- **Screen flows vs. views** — interactive wizards / multi-step forms are
  **automation** (screen flows). Static record / list / dashboard surfaces are
  **ui**.
- **Any CEL expression** — load **objectstack-formula** alongside the host
  skill (data validations, automation guards, UI visibility, AI tool params).
- **Kernel / plugin events vs. data lifecycle** — `PluginContext` lifecycle and
  `EventBus` belong to **objectstack-platform**; record-level hooks belong to
  **objectstack-data**.

---

## Related repositories

- [`../objectui`](https://github.com/objectstack-ai/objectui) — Studio UI (separate repo).
- [`../templates`](https://github.com/objectstack-ai/templates) — template library
  consumed by `create-objectstack` (separate repo). Scaffolds reference these
  skills; keep this index in sync when adding or renaming a skill.

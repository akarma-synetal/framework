---
'@objectstack/spec': minor
'@objectstack/objectql': patch
'@objectstack/metadata': patch
'@objectstack/runtime': patch
'@objectstack/example-crm': patch
---

Promote `email_template` to a first-class metadata type using the canonical
`EmailTemplateDefinitionSchema`.

Previously `email_template` had two competing Zod schemas (Prime Directive
#8 violation): the legacy `EmailTemplateSchema` (a sub-shape of
`Notification`) and the richer `EmailTemplateDefinitionSchema`. The runtime
metadata protocol (`packages/objectql/src/protocol.ts`) and Studio's
property panel registered the legacy one, which is why all the new fields
(`name`, `label`, `category`, `locale`, `bodyHtml`, `bodyText`, …) were
reported as “declared in form layout but missing from schema”.

This change:

- Repoints the `email_template` entry in `TYPE_TO_SCHEMA`
  (`packages/objectql/src/protocol.ts`) and in
  `BUILTIN_METADATA_TYPE_SCHEMAS`
  (`packages/spec/src/kernel/metadata-type-schemas.ts`) to
  `EmailTemplateDefinitionSchema`. The legacy `EmailTemplateSchema` is
  kept only as an inline sub-shape inside `Notification`.
- Adds an `emailTemplates` collection to `defineStack()` input
  (`packages/spec/src/stack.zod.ts`), registers it in
  `MAP_SUPPORTED_FIELDS`/`PLURAL_TO_SINGULAR`
  (`packages/spec/src/shared/metadata-collection.zod.ts`), wires it into
  `ARTIFACT_FIELD_TO_TYPE` (`packages/metadata/src/plugin.ts`) and
  `APP_CATEGORY_KEYS` (`packages/runtime/src/app-plugin.ts`).
- Rewrites `packages/spec/src/system/email-template.form.ts` for the new
  schema with sections for Identity, Subject, HTML body, Plain-text body,
  Variables, Delivery overrides, Status.
- Ships three reference templates in `examples/app-crm/src/emails/`:
  `crm.deal_won` (rewritten to canonical shape), `crm.welcome` (new),
  `crm.lead_followup` (new), and wires them into the CRM stack via
  `emailTemplates: Object.values(emails)`.

End-to-end verified in Studio: list view at
`/_console/apps/studio/metadata/email_template` shows all three entries;
the detail view renders the EmailTemplatePreview iframe and the property
panel cleanly renders every canonical field (no missing-schema warnings).
`GET /api/v1/meta` now returns the new `properties` set
(`name, label, category, locale, subject, bodyHtml, bodyText, variables,
fromOverride, replyTo, active, isSystem, description`).

---
'@objectstack/metadata': patch
'@objectstack/runtime': patch
---

Fix dev-mode HMR data-reload for view metadata.

`MetadataPlugin._parseAndRegisterArtifact` previously required a top-level
`name` on every artifact item and silently skipped those without one.
View bundles in the compiled artifact carry no top-level `name` (their
identity is the target object, encoded under `list.data.object` /
`form.data.object` — same pattern used by `ObjectQL.SchemaRegistry`'s
`resolveMetadataItemName`). As a result, artifact-loaded views never
reached `MetadataManager`, and HMR file pushes never affected the read
path: API responses kept returning the boot-time `SchemaRegistry` copy.

This change derives the registration key from `list.data.object` (or
`form.data.object`) when no top-level `name` is present, mirroring the
ObjectQL convention.

Also splits the `MetadataPlugin` watch flag into two independent
options so dev mode can enable artifact-file HMR without paying the
cost of the source-file scanner:

- `watch` — controls `NodeMetadataManager`'s recursive source scan
  (default `false`; turning it on in artifact mode would polling-scan
  the entire project root including `node_modules`).
- `artifactWatch` — controls the cheap single-file polling watcher on
  the compiled artifact (`dist/objectstack.json`). The standalone stack
  enables this automatically when `NODE_ENV !== 'production'`.

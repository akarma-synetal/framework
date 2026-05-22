---
"@objectstack/metadata-core": minor
"@objectstack/metadata-fs": minor
"@objectstack/metadata": minor
"@objectstack/objectql": minor
"@objectstack/runtime": minor
---

**BREAKING — metadata: remove `project` and `branch` from `MetaRef`**

The metadata layer no longer models project or branch. Customisation is now
scoped purely to **organisation**. Project remains exclusively as an artifact
packaging concept (the `objectstack.json` bundle envelope); branching is left
to Git.

What changed:

- `MetaRef` is now `{ org, type, name, version? }` (was
  `{ org, project, branch, type, name, version? }`). `refKey()` is the two
  segment string `${org}/${type}/${name}` (was five segments).
- `MetadataItem.seq` is monotonic **per org** (was per branch).
- `BranchRef`, `MergeStrategy`, `MergeResult` types and the optional
  `fork`/`merge` methods on `MetadataRepository` are removed.
- `ListFilter` / `WatchFilter` / `HistoryOptions` no longer accept `project`
  or `branch`.
- `FileSystemRepository` disk layout simplified to
  `<root>/<type>/<name>.json` (was `<root>/<project>/<branch>/<type>/<name>.json`);
  change-log path is now `.objectstack/.log/main.jsonl` regardless of any
  branch concept. Constructor no longer accepts `project` / `branch`.
- `SysMetadataRepository`: removed `projectLabel` / `branchLabel` options;
  the `sys_metadata` schema's `project_id` / `branch` columns (if present)
  are ignored. A future major release will `DROP` them.
- `MetadataManager.setRepository(repo, opts)` no longer takes an opts object
  with `branch`.

Migration:

```diff
-const ref = { org: 'acme', project: 'crm', branch: 'main', type: 'view', name: 'home' };
+const ref = { org: 'acme', type: 'view', name: 'home' };

-new FileSystemRepository({ root, org: 'acme', project: 'crm', branch: 'main' });
+new FileSystemRepository({ root, org: 'acme' });
```

Existing `sys_metadata` rows continue to load; the deprecated columns are
ignored at read time.

# @objectstack/metadata-fs

`FileSystemRepository` — Node-only implementation of the
`MetadataRepository` contract defined in `@objectstack/metadata-core`.

## Layout on disk

```
<root>/
  <type>/
    <name>.json          # canonical body of the item
  .objectstack/
    .log/
      main.jsonl         # append-only change log (one JSON object per line)
```

For example:

```
metadata/
  view/
    case_grid.json
    case_timeline.json
  object/
    case.json
  .objectstack/.log/main.jsonl
```

## Usage

```ts
import { FileSystemRepository } from '@objectstack/metadata-fs';

const repo = new FileSystemRepository({
  root: './metadata',
  org: 'system',
});
await repo.start();          // scan + open watcher

const view = await repo.get({
  org: 'system',
  type: 'view', name: 'case_grid',
});

for await (const evt of repo.watch({})) {
  console.log('changed', evt.ref, evt.hash);
}
```

See ADR-0008 (incl. §0 amendment) and the `metadata-branch-removal` changeset.

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Append-only JSONL change log writer / reader. Each line is a single
 * `MetadataEvent` serialized via `JSON.stringify`.
 *
 * Durability strategy
 * ───────────────────
 *   - Append with `O_APPEND` semantics (Node's `fs.appendFile` is
 *     atomic for sub-PIPE_BUF-sized writes; events are well under 4 KiB).
 *   - Read by streaming the file line-by-line and JSON.parse-ing each.
 *   - On a corrupt line we skip and continue — the body files are the
 *     source of truth; the log is a denormalised history index.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { createReadStream, existsSync } from 'node:fs';
import type { MetadataEvent } from '@objectstack/metadata-core';

export class JsonlLog {
  constructor(private readonly file: string) {}

  async append(evt: MetadataEvent): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.appendFile(this.file, JSON.stringify(evt) + '\n', 'utf8');
  }

  /** Read all events in seq order (i.e. file order). */
  async *readAll(): AsyncIterable<MetadataEvent> {
    if (!existsSync(this.file)) return;
    const rl = readline.createInterface({
      input: createReadStream(this.file, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    try {
      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          yield JSON.parse(line) as MetadataEvent;
        } catch {
          // Skip corrupt line.
        }
      }
    } finally {
      rl.close();
    }
  }

  /** Return the highest seq number in the log, or 0 if empty. */
  async highestSeq(): Promise<number> {
    let max = 0;
    for await (const evt of this.readAll()) {
      if (typeof evt.seq === 'number' && evt.seq > max) max = evt.seq;
    }
    return max;
  }
}

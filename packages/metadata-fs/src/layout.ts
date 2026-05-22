// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Disk layout helpers — see ADR-0008 §10 PR-4 / packages/metadata-fs README.
 *
 *   <root>/<type>/<name>.json     — canonical body
 *   <root>/.objectstack/.log/main.jsonl  — append-only change log
 */

import path from 'node:path';
import type { MetadataType } from '@objectstack/metadata-core';

export interface FsLayout {
  /** Absolute path to the metadata root. */
  root: string;
}

export function itemPath(layout: FsLayout, type: MetadataType, name: string): string {
  return path.join(layout.root, type, `${name}.json`);
}

export function typeDir(layout: FsLayout, type: MetadataType): string {
  return path.join(layout.root, type);
}

export function logDir(layout: FsLayout): string {
  return path.join(layout.root, '.objectstack', '.log');
}

export function logFile(layout: FsLayout): string {
  // Single change log per filesystem root (branching is a Git concern,
  // not a metadata-layer concern).
  return path.join(logDir(layout), `main.jsonl`);
}

/** Parse a path like ".../view/case_grid.json" into {type, name}. */
export function parseItemPath(
  layout: FsLayout,
  absPath: string,
): { type: string; name: string } | null {
  const rel = path.relative(layout.root, absPath);
  if (rel.startsWith('..') || rel.startsWith('.objectstack')) return null;
  const segments = rel.split(path.sep);
  if (segments.length !== 2) return null;
  const type = segments[0]!;
  const file = segments[1]!;
  if (!file.endsWith('.json')) return null;
  const name = file.slice(0, -'.json'.length);
  return { type, name };
}

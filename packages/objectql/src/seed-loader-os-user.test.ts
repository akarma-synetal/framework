// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { resolveSeedRecord } from '@objectstack/formula';

/**
 * The SeedLoader binds `os.user` to a NULL identity (`{ id: null }`) when no
 * real user exists at seed time (the normal case). This proves the resolution
 * behavior that lets us drop the `usr_system` placeholder entirely:
 * `owner_id: cel`os.user.id`` resolves to NULL (not a crash, not a dropped
 * record), and the first-admin handoff later claims the NULL-owned row.
 */
describe('seed os.user binding (usr_system-free)', () => {
  const cel = (source: string) => ({ dialect: 'cel', source });

  it('resolves os.user.id to null under a NULL identity (no error, no drop)', () => {
    const rec = { name: 'Acme', owner_id: cel('os.user.id') };
    const ctx = { now: new Date(), user: { id: null }, org: undefined, env: {} };

    const result = resolveSeedRecord(rec as any, ctx as any);

    expect(result.ok).toBe(true);
    expect((result as any).value.owner_id).toBeNull();
    // Non-identity dynamic values still resolve normally alongside it.
    expect((result as any).value.name).toBe('Acme');
  });

  it('still resolves a real os.user.id when an identity IS supplied (per-org replay)', () => {
    const rec = { owner_id: cel('os.user.id') };
    const ctx = { now: new Date(), user: { id: 'usr_real_admin' }, org: undefined, env: {} };

    const result = resolveSeedRecord(rec as any, ctx as any);

    expect(result.ok).toBe(true);
    expect((result as any).value.owner_id).toBe('usr_real_admin');
  });
});

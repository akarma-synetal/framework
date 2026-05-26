// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ObjectStackProtocolImplementation } from './protocol.js';
import { SchemaRegistry } from './registry.js';
import { resetEnvWritableMetadataTypes } from './sys-metadata-repository.js';

/**
 * Phase 3a-1 + 3a-env-writable tests.
 *
 * Validates that:
 *   • `getMetaTypes()` returns enriched `entries` alongside the legacy
 *     `types` array (back-compat preserved).
 *   • Registry metadata (label, domain, allowOrgOverride, …) flows through
 *     from DEFAULT_METADATA_TYPE_REGISTRY.
 *   • `OBJECTSTACK_METADATA_WRITABLE` env var elevates `allowOrgOverride`
 *     at runtime, and tags the entry with `overrideSource: 'env'`.
 *   • The env-elevated set is also honoured by the saveMetaItem 403 gate.
 */
describe('ObjectStackProtocolImplementation - getMetaTypes rich response', () => {
    let protocol: ObjectStackProtocolImplementation;
    let mockEngine: any;
    let registry: SchemaRegistry;
    const originalEnv = process.env.OBJECTSTACK_METADATA_WRITABLE;

    beforeEach(() => {
        registry = new SchemaRegistry({ multiTenant: false });
        // Pre-register a handful of object schemas so getRegisteredTypes()
        // returns something realistic.
        registry.registerItem('object', { name: 'sys_user', label: 'User' }, 'name');
        registry.registerItem('view', { name: 'sys_user.grid', type: 'grid', object: 'sys_user' }, 'name');
        registry.registerItem('app', { name: 'crm', label: 'CRM' }, 'name');

        mockEngine = {
            registry,
            find: vi.fn().mockResolvedValue([]),
            findOne: vi.fn().mockResolvedValue(null),
            insert: vi.fn().mockResolvedValue({ id: 'x' }),
            update: vi.fn().mockResolvedValue({ id: 'x' }),
            delete: vi.fn().mockResolvedValue({ deleted: 1 }),
            count: vi.fn().mockResolvedValue(0),
            aggregate: vi.fn().mockResolvedValue([]),
        };
        protocol = new ObjectStackProtocolImplementation(mockEngine);
        ObjectStackProtocolImplementation.resetEnvWritableCache();
        resetEnvWritableMetadataTypes();
    });

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.OBJECTSTACK_METADATA_WRITABLE;
        } else {
            process.env.OBJECTSTACK_METADATA_WRITABLE = originalEnv;
        }
        ObjectStackProtocolImplementation.resetEnvWritableCache();
        resetEnvWritableMetadataTypes();
    });

    it('returns both legacy `types` array and rich `entries` array', async () => {
        const result: any = await protocol.getMetaTypes();
        expect(Array.isArray(result.types)).toBe(true);
        expect(Array.isArray(result.entries)).toBe(true);
        expect(result.types.length).toBeGreaterThan(0);
        expect(result.entries.length).toBeGreaterThan(0);
    });

    it('enriches known types with registry metadata', async () => {
        const result: any = await protocol.getMetaTypes();
        const objectEntry = result.entries.find((e: any) => e.type === 'object');
        expect(objectEntry).toBeDefined();
        expect(objectEntry.label).toBe('Object');
        expect(objectEntry.domain).toBe('data');
        expect(objectEntry.allowOrgOverride).toBe(false);
        expect(objectEntry.overrideSource).toBe('registry');
        expect(objectEntry.supportsOverlay).toBe(true);

        const viewEntry = result.entries.find((e: any) => e.type === 'view');
        expect(viewEntry).toBeDefined();
        expect(viewEntry.allowOrgOverride).toBe(true);
        expect(viewEntry.domain).toBe('ui');
    });

    it('honours OBJECTSTACK_METADATA_WRITABLE to elevate allowOrgOverride', async () => {
        process.env.OBJECTSTACK_METADATA_WRITABLE = 'object,permission';
        ObjectStackProtocolImplementation.resetEnvWritableCache();

        const result: any = await protocol.getMetaTypes();
        const objectEntry = result.entries.find((e: any) => e.type === 'object');
        expect(objectEntry.allowOrgOverride).toBe(true);
        expect(objectEntry.overrideSource).toBe('env');

        // Types not listed retain their registry value.
        const appEntry = result.entries.find((e: any) => e.type === 'app');
        expect(appEntry.allowOrgOverride).toBe(false);
        expect(appEntry.overrideSource).toBe('registry');
    });

    it('saveMetaItem honours the env-elevated allow list', async () => {
        // Scoped (project) protocol — overlay gate applies.
        const scoped = new ObjectStackProtocolImplementation(mockEngine, undefined, undefined, 'env_alpha');
        mockEngine.findOne.mockResolvedValue(null);

        // Without env var: object writes blocked.
        delete process.env.OBJECTSTACK_METADATA_WRITABLE;
        ObjectStackProtocolImplementation.resetEnvWritableCache();
        resetEnvWritableMetadataTypes();
        await expect(
            scoped.saveMetaItem({ type: 'object', name: 'sys_user', item: { name: 'sys_user' } })
        ).rejects.toThrow(/not_overridable/);

        // With env var: object writes allowed.
        process.env.OBJECTSTACK_METADATA_WRITABLE = 'object';
        ObjectStackProtocolImplementation.resetEnvWritableCache();
        resetEnvWritableMetadataTypes();
        // Should no longer throw "not_overridable". (May still hit unrelated
        // persistence errors from the mock engine — we only assert the gate.)
        try {
            await scoped.saveMetaItem({ type: 'object', name: 'sys_user', item: { name: 'sys_user' } });
        } catch (err: any) {
            expect(err.code).not.toBe('not_overridable');
        }
    });

    it('returns entries sorted by domain, then by type name', async () => {
        const result: any = await protocol.getMetaTypes();
        for (let i = 1; i < result.entries.length; i++) {
            const prev = result.entries[i - 1];
            const curr = result.entries[i];
            if (prev.domain === curr.domain) {
                expect(prev.type.localeCompare(curr.type)).toBeLessThanOrEqual(0);
            } else {
                expect(prev.domain.localeCompare(curr.domain)).toBeLessThanOrEqual(0);
            }
        }
    });
});

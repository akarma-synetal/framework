// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { MetadataPlugin } from './plugin';
import { NodeMetadataManager } from './node-metadata-manager';

vi.mock('@objectstack/core', async (orig) => {
    const real = (await orig()) as any;
    return {
        ...real,
        createLogger: () => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        }),
    };
});

describe('MetadataPlugin — bootstrap × watch coupling (D2)', () => {
    it('attaches a filesystem watcher in eager mode when watch=true', () => {
        const plugin = new MetadataPlugin({
            watch: true,
            config: { bootstrap: 'eager' },
        });
        const mgr = (plugin as any).manager as NodeMetadataManager;
        expect((mgr as any).watcher).toBeDefined();
        // Cleanup
        return mgr.stopWatching();
    });

    it('attaches a filesystem watcher in lazy mode when watch=true', () => {
        const plugin = new MetadataPlugin({
            watch: true,
            config: { bootstrap: 'lazy' },
        });
        const mgr = (plugin as any).manager as NodeMetadataManager;
        expect((mgr as any).watcher).toBeDefined();
        return mgr.stopWatching();
    });

    it('NEVER attaches a filesystem watcher in artifact-only mode', () => {
        const plugin = new MetadataPlugin({
            watch: true, // explicitly requested — must be ignored
            config: { bootstrap: 'artifact-only' },
        });
        const mgr = (plugin as any).manager as NodeMetadataManager;
        expect((mgr as any).watcher).toBeUndefined();
    });

    it('honors watch=false in eager mode', () => {
        const plugin = new MetadataPlugin({
            watch: false,
            config: { bootstrap: 'eager' },
        });
        const mgr = (plugin as any).manager as NodeMetadataManager;
        expect((mgr as any).watcher).toBeUndefined();
    });
});

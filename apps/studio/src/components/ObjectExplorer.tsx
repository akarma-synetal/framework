// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectExplorer — Airtable-style canvas for an `object` metadata item.
 *
 * Controlled component: the active panel (records / fields / api) is
 * driven by the `mode` prop from {@link PluginHost}. This component
 * intentionally has **no** internal tab strip — PluginHost's mode
 * switcher is the single source of truth so the page only ever shows
 * one row of mode buttons.
 *
 * Mode mapping (see `object-plugin.tsx`):
 *   - `data`   → records grid via `@object-ui/plugin-grid`'s ObjectGrid
 *                (the same mature component runtime apps use — full
 *                Airtable-style filter/group/sort/density/edit out of
 *                the box, no hand-rolled table to maintain).
 *   - `design` → field/schema editor (ObjectSchemaInspector — schema,
 *                not data, so not replaced by @object-ui).
 *   - `code`   → REST API console.
 */

import { useEffect, useState } from 'react';
import { ObjectGrid } from '@object-ui/plugin-grid';
import { useClient } from '@objectstack/client-react';
import { useParams } from '@tanstack/react-router';
import type { ViewMode } from '@objectstack/spec/studio';
import { ObjectSchemaInspector } from './ObjectSchemaInspector';
import { ObjectApiConsole } from './ObjectApiConsole';
import { useObjectUiDataSource } from '@/hooks/useObjectUiDataSource';
import { useScopedClient } from '@/hooks/useObjectStackClient';

interface ObjectExplorerProps {
  objectApiName: string;
  /** Active panel, driven by PluginHost. Falls back to records grid. */
  mode?: ViewMode;
}

/**
 * Designer-mode Records grid: like Airtable, surface every field by
 * default so authors can see exactly what their schema produces.
 * @object-ui's ObjectGrid picks a minimal column set when no `columns`
 * are passed; for the schema-designer context we want the full picture.
 */
function DesignerRecordsGrid({ objectApiName }: { objectApiName: string }) {
  const dataSource = useObjectUiDataSource();
  const unscoped = useClient();
  const params = useParams({ strict: false }) as { projectId?: string };
  const scoped = useScopedClient(params.projectId);
  const client: any = scoped ?? unscoped;
  const [columns, setColumns] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const found: any = await client.meta.getItem('object', objectApiName);
        const def = found?.item || found?.spec || found;
        const fields = def?.fields || {};
        const all = Object.keys(fields)
          .map((k) => fields[k]?.name || k)
          // Hide framework-internal projection fields that aren't useful in the designer.
          .filter((n) => n && n !== 'formatted_summary');
        if (mounted) setColumns(all);
      } catch {
        if (mounted) setColumns(undefined);
      }
    })();
    return () => { mounted = false; };
  }, [client, objectApiName]);

  return (
    <ObjectGrid
      schema={{ type: 'object-grid', objectName: objectApiName, ...(columns ? { columns } : {}) }}
      dataSource={dataSource}
      className="h-full"
    />
  );
}

export function ObjectExplorer({ objectApiName, mode = 'data' }: ObjectExplorerProps) {
  const panel = mode === 'design' ? 'design' : mode === 'code' ? 'code' : 'data';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        {panel === 'data' && <DesignerRecordsGrid objectApiName={objectApiName} />}
        {panel === 'design' && <ObjectSchemaInspector objectApiName={objectApiName} />}
        {panel === 'code' && <ObjectApiConsole objectApiName={objectApiName} />}
      </div>
    </div>
  );
}

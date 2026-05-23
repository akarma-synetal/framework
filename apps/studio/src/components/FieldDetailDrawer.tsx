// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FieldDetailDrawer — read-only side panel for inspecting a single field.
 *
 * Opens when a row in the Fields table is clicked. Shows the full field
 * spec (every property normalised from the schema), plus two power-user
 * escape hatches:
 *
 *   • Open in VS Code — vscode:// deep-link to the parent object's source
 *     file (the vscode-objectstack extension resolves it).
 *   • Copy field snippet — defineField-style TS literal of just this
 *     field, ready to paste somewhere.
 *
 * Why a drawer (not a modal): the user is exploring; they want to keep
 * the field list visible so they can quickly compare adjacent fields.
 */

import { useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

export interface FieldSpec {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  multiple?: boolean;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string } | string>;
  reference?: string;
  maxLength?: number;
  formula?: string;
  description?: string;
  /** All other properties from the schema, surfaced verbatim. */
  [key: string]: unknown;
}

interface FieldDetailDrawerProps {
  field: FieldSpec | null;
  objectName: string;
  packageId?: string;
  onClose: () => void;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return JSON.stringify(v, null, 2);
}

function fieldSnippet(field: FieldSpec): string {
  // Strip the synthetic keys we attach in normalisation; emit a clean object
  // literal ordered by author intent (name first, then label, type, then
  // optional config in a stable order).
  const order = ['name', 'label', 'type', 'required', 'multiple', 'maxLength', 'defaultValue', 'options', 'reference', 'formula', 'description'];
  const ordered: Record<string, unknown> = {};
  for (const k of order) if (field[k] !== undefined) ordered[k] = field[k];
  for (const k of Object.keys(field)) {
    if (!order.includes(k) && field[k] !== undefined) ordered[k] = field[k];
  }
  const json = JSON.stringify(ordered, null, 2);
  return `${field.name}: ${json},`;
}

export function FieldDetailDrawer({ field, objectName, packageId, onClose }: FieldDetailDrawerProps) {
  const [copied, setCopied] = useState(false);

  const openVsCode = useCallback(() => {
    if (!field) return;
    const uri = `vscode://objectstack.vscode-objectstack/open?type=object&name=${encodeURIComponent(objectName)}${packageId ? `&package=${encodeURIComponent(packageId)}` : ''}&field=${encodeURIComponent(field.name)}`;
    window.location.href = uri;
  }, [field, objectName, packageId]);

  const copySnippet = useCallback(async () => {
    if (!field) return;
    try {
      await navigator.clipboard.writeText(fieldSnippet(field));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast({ title: `Copied ${field.name} snippet` });
    } catch {
      toast({ title: 'Clipboard unavailable', variant: 'destructive' as any });
    }
  }, [field]);

  if (!field) return null;

  // Surface every non-internal property in a definition list. Skip ones we
  // already render in the header (name, label, type).
  const headerKeys = new Set(['name', 'label', 'type']);
  const detailEntries = Object.entries(field).filter(([k, v]) => !headerKeys.has(k) && v !== undefined && v !== false && v !== null && v !== '');

  return (
    <Sheet open={!!field} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader className="space-y-2 pb-4">
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm font-medium">{field.name}</code>
            <Badge variant="outline" className="text-[10px]">{field.type}{field.multiple ? '[]' : ''}</Badge>
            {field.required && (
              <Badge className="bg-amber-100 text-[10px] text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                Required
              </Badge>
            )}
          </div>
          <SheetTitle className="text-base font-medium">{field.label}</SheetTitle>
          {field.description ? (
            <SheetDescription className="text-xs">{field.description}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">Field details</SheetDescription>
          )}
        </SheetHeader>

        <div className="border-t pt-4">
          <dl className="space-y-2.5">
            {detailEntries.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">No additional configuration. This is a plain {field.type} field.</p>
            ) : detailEntries.map(([key, value]) => (
              <div key={key} className="grid grid-cols-[120px_1fr] items-start gap-2 text-xs">
                <dt className="font-medium text-muted-foreground">{key}</dt>
                <dd className="min-w-0 break-words font-mono">
                  {key === 'options' && Array.isArray(value) ? (
                    <ul className="space-y-0.5">
                      {(value as any[]).map((opt, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                            {typeof opt === 'string' ? opt : opt.value}
                          </code>
                          {typeof opt !== 'string' && opt.label && (
                            <span className="text-muted-foreground">{opt.label}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <pre className="whitespace-pre-wrap text-[11px]">{formatValue(value)}</pre>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6 flex gap-2 border-t pt-4">
          <Button variant="outline" size="sm" onClick={openVsCode} className="flex-1 gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Open in VS Code
          </Button>
          <Button variant="outline" size="sm" onClick={copySnippet} className="flex-1 gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy snippet'}
          </Button>
        </div>

        <p className="mt-4 text-[10px] text-muted-foreground">
          Field definitions live in the object's <code className="rounded bg-muted px-1 py-0.5">.object.ts</code> source.
          Edit there and HMR will reload Studio in &lt; 1 s.
        </p>
      </SheetContent>
    </Sheet>
  );
}

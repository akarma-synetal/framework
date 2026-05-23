// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AddFieldDialog — guided "+ Add field" flow.
 *
 * ObjectStack is metadata-as-code: field definitions live in the
 * `.object.ts` source file under examples/<app>/src/objects/. The dialog
 * therefore doesn't write to the filesystem from the browser. Instead it
 * generates a snippet for the chosen field type, lets the user copy it,
 * and offers a deep-link to open the source file in VS Code.
 *
 * This is the smallest meaningful step toward a builder experience that
 * stays true to Prime Directive #6 (no temporary workarounds). When the
 * runtime overlay write-path is mature, we can swap the snippet flow for
 * a real persist call without touching the dialog's contract.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Type, FileText, Hash, ToggleLeft, List, Link as LinkIcon, Calculator,
  Calendar, Mail, Phone, MapPin, Braces, DollarSign, Percent, Clock,
  ExternalLink, Copy, Check,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AddFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectName: string;
  packageId?: string;
}

interface FieldTypeOption {
  type: string;
  label: string;
  icon: React.ElementType;
  description: string;
  snippet: (name: string, label: string) => string;
}

const indent = '  ';
const wrap = (name: string, label: string, body: string) =>
  `${indent}${name}: {\n${indent}  name: '${name}',\n${indent}  label: '${label}',\n${body}${indent}},`;

const FIELD_TYPES: FieldTypeOption[] = [
  {
    type: 'text', label: 'Single-line text', icon: Type,
    description: 'Short string up to 255 chars',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'text',\n${indent}  maxLength: 255,\n`),
  },
  {
    type: 'longtext', label: 'Long text', icon: FileText,
    description: 'Multi-paragraph text, no length cap',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'longtext',\n`),
  },
  {
    type: 'number', label: 'Number', icon: Hash,
    description: 'Integer or decimal',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'number',\n`),
  },
  {
    type: 'currency', label: 'Currency', icon: DollarSign,
    description: 'Monetary amount (locale-aware)',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'currency',\n`),
  },
  {
    type: 'percent', label: 'Percent', icon: Percent,
    description: '0–100 with % display',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'percent',\n`),
  },
  {
    type: 'boolean', label: 'Boolean', icon: ToggleLeft,
    description: 'true / false toggle',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'boolean',\n${indent}  defaultValue: false,\n`),
  },
  {
    type: 'select', label: 'Single-select', icon: List,
    description: 'Pick one from a fixed option list',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'select',\n${indent}  options: [\n${indent}    { value: 'option_a', label: 'Option A' },\n${indent}    { value: 'option_b', label: 'Option B' },\n${indent}  ],\n`),
  },
  {
    type: 'multiselect', label: 'Multi-select', icon: List,
    description: 'Pick many from a fixed option list',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'multiselect',\n${indent}  options: [\n${indent}    { value: 'tag_a', label: 'Tag A' },\n${indent}    { value: 'tag_b', label: 'Tag B' },\n${indent}  ],\n`),
  },
  {
    type: 'lookup', label: 'Lookup / Reference', icon: LinkIcon,
    description: 'Link to another object',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'lookup',\n${indent}  reference: 'TARGET_OBJECT_NAME',\n`),
  },
  {
    type: 'formula', label: 'Formula', icon: Calculator,
    description: 'Computed value (CEL expression)',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'formula',\n${indent}  formula: '// CEL expression',\n`),
  },
  {
    type: 'date', label: 'Date', icon: Calendar,
    description: 'Day, no time component',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'date',\n`),
  },
  {
    type: 'datetime', label: 'Date & time', icon: Calendar,
    description: 'Instant with timezone',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'datetime',\n`),
  },
  {
    type: 'time', label: 'Time', icon: Clock,
    description: 'Clock time, no date',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'time',\n`),
  },
  {
    type: 'email', label: 'Email', icon: Mail,
    description: 'Validated email address',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'email',\n`),
  },
  {
    type: 'phone', label: 'Phone', icon: Phone,
    description: 'Phone number (free-form)',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'phone',\n`),
  },
  {
    type: 'url', label: 'URL', icon: LinkIcon,
    description: 'Validated http(s) URL',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'url',\n`),
  },
  {
    type: 'address', label: 'Address', icon: MapPin,
    description: 'Structured postal address',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'address',\n`),
  },
  {
    type: 'json', label: 'JSON', icon: Braces,
    description: 'Arbitrary JSON blob',
    snippet: (n, l) => wrap(n, l, `${indent}  type: 'json',\n`),
  },
];

function toSnakeCase(s: string): string {
  return s
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export function AddFieldDialog({ open, onOpenChange, objectName, packageId }: AddFieldDialogProps) {
  const [selectedType, setSelectedType] = useState<string>('text');
  const [fieldLabel, setFieldLabel] = useState<string>('New field');
  const [copied, setCopied] = useState(false);

  const fieldName = useMemo(() => toSnakeCase(fieldLabel) || 'new_field', [fieldLabel]);

  const selected = FIELD_TYPES.find(t => t.type === selectedType) || FIELD_TYPES[0];
  const snippet = useMemo(() => selected.snippet(fieldName, fieldLabel || 'New field'), [selected, fieldName, fieldLabel]);

  const copySnippet = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast({ title: `Copied ${fieldName} snippet` });
    } catch {
      toast({ title: 'Clipboard unavailable', variant: 'destructive' as any });
    }
  }, [snippet, fieldName]);

  const openVsCode = useCallback(() => {
    const uri = `vscode://objectstack.vscode-objectstack/open?type=object&name=${encodeURIComponent(objectName)}${packageId ? `&package=${encodeURIComponent(packageId)}` : ''}`;
    window.location.href = uri;
  }, [objectName, packageId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Add field to <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{objectName}</code>
          </DialogTitle>
          <DialogDescription>
            ObjectStack is metadata-as-code. Pick a type, copy the snippet, paste into your <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">.object.ts</code> file. HMR reloads Studio in &lt; 1 s.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="field-label" className="text-xs">Display label</Label>
              <Input
                id="field-label"
                value={fieldLabel}
                onChange={e => setFieldLabel(e.target.value)}
                placeholder="e.g. Customer name"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Machine name <span className="text-muted-foreground">(snake_case, derived)</span></Label>
              <code className="block h-8 rounded border bg-muted/30 px-2 py-1.5 font-mono text-sm">{fieldName}</code>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Field type</Label>
            <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto rounded border p-2 sm:grid-cols-3">
              {FIELD_TYPES.map(t => {
                const Icon = t.icon;
                const active = selectedType === t.type;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setSelectedType(t.type)}
                    className={`flex flex-col items-start gap-0.5 rounded border px-2 py-1.5 text-left text-xs transition ${active
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-transparent hover:bg-accent'}`}
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <Icon className="h-3 w-3" />
                      {t.label}
                    </div>
                    <span className="text-[10px] leading-tight text-muted-foreground">{t.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Snippet preview</Label>
              <Badge variant="outline" className="font-mono text-[10px]">{selected.type}</Badge>
            </div>
            <pre className="max-h-40 overflow-auto rounded border bg-muted/20 p-2.5 font-mono text-[11px] leading-relaxed">{snippet}</pre>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={openVsCode} className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Open .object.ts in VS Code
          </Button>
          <Button size="sm" onClick={copySnippet} className="gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied — paste into fields: { … }' : 'Copy snippet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

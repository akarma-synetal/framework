// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  SpecifierType,
  SpecifierSchema,
  SettingsManifestSchema,
  ResolvedSettingValueSchema,
  SettingsNamespacePayloadSchema,
  SettingsActionResultSchema,
  type SettingsManifest,
  type Specifier,
} from './settings-manifest.zod';

describe('SpecifierType', () => {
  it('accepts the closed set of specifier kinds', () => {
    const kinds = [
      'group', 'child_pane', 'info_banner', 'title_value',
      'text', 'textarea', 'password', 'email', 'url', 'phone',
      'number', 'toggle', 'select', 'radio', 'multiselect',
      'slider', 'color', 'json', 'action_button',
    ];
    for (const k of kinds) {
      expect(() => SpecifierType.parse(k)).not.toThrow();
    }
  });

  it('rejects unknown specifier kinds', () => {
    expect(() => SpecifierType.parse('rich_text')).toThrow();
    expect(() => SpecifierType.parse('')).toThrow();
  });
});

describe('SpecifierSchema — value-bearing specifiers', () => {
  it('accepts a minimal text specifier', () => {
    const spec: Specifier = {
      type: 'text',
      key: 'smtp_host',
      label: 'Host',
      required: false,
    };
    const parsed = SpecifierSchema.parse(spec);
    expect(parsed.key).toBe('smtp_host');
    expect(parsed.type).toBe('text');
  });

  it('requires a key for value-bearing specifiers', () => {
    expect(() =>
      SpecifierSchema.parse({ type: 'text', label: 'No key' } as any)
    ).toThrow(/requires a 'key'/);
  });

  it('accepts a password specifier (encryption is implicit)', () => {
    const parsed = SpecifierSchema.parse({
      type: 'password',
      key: 'api_key',
      label: 'API Key',
    });
    expect(parsed.type).toBe('password');
  });

  it('enforces min ≤ max on numeric specifiers', () => {
    expect(() =>
      SpecifierSchema.parse({
        type: 'number',
        key: 'retries',
        label: 'Retries',
        min: 10,
        max: 3,
      })
    ).toThrow(/'min' must be ≤ 'max'/);
  });

  it('enforces minLength ≤ maxLength on text specifiers', () => {
    expect(() =>
      SpecifierSchema.parse({
        type: 'text',
        key: 'name',
        label: 'Name',
        minLength: 10,
        maxLength: 4,
      })
    ).toThrow(/'minLength' must be ≤ 'maxLength'/);
  });

  it('requires options on select specifiers', () => {
    expect(() =>
      SpecifierSchema.parse({
        type: 'select',
        key: 'provider',
        label: 'Provider',
      })
    ).toThrow(/requires non-empty 'options'/);
  });

  it('accepts a select with options', () => {
    const parsed = SpecifierSchema.parse({
      type: 'select',
      key: 'provider',
      label: 'Provider',
      options: [
        { value: 'smtp', label: 'SMTP' },
        { value: 'sendgrid', label: 'SendGrid' },
      ],
    });
    expect(parsed.options).toHaveLength(2);
  });

  it('rejects deprecated without replacedBy', () => {
    expect(() =>
      SpecifierSchema.parse({
        type: 'text',
        key: 'old_key',
        label: 'Old',
        deprecated: true,
      })
    ).toThrow(/replacedBy/);
  });
});

describe('SpecifierSchema — layout-only specifiers', () => {
  it('accepts a group without a key', () => {
    const parsed = SpecifierSchema.parse({
      type: 'group',
      label: 'SMTP',
    });
    expect(parsed.type).toBe('group');
    expect(parsed.key).toBeUndefined();
  });

  it('rejects a group that carries a key', () => {
    expect(() =>
      SpecifierSchema.parse({
        type: 'group',
        key: 'should_not_have_key',
        label: 'Bad Group',
      })
    ).toThrow(/must not declare a 'key'/);
  });

  it('accepts an info_banner with text', () => {
    expect(() =>
      SpecifierSchema.parse({
        type: 'info_banner',
        label: 'Notice',
        bannerText: 'Be careful with **prod** credentials.',
        bannerSeverity: 'warning',
      })
    ).not.toThrow();
  });

  it('rejects an info_banner without bannerText', () => {
    expect(() =>
      SpecifierSchema.parse({ type: 'info_banner', label: 'Notice' })
    ).toThrow(/requires 'bannerText'/);
  });

  it('accepts a child_pane with childNamespace', () => {
    expect(() =>
      SpecifierSchema.parse({
        type: 'child_pane',
        label: 'Advanced',
        childNamespace: 'mail_advanced',
      })
    ).not.toThrow();
  });

  it('rejects a child_pane without childNamespace', () => {
    expect(() =>
      SpecifierSchema.parse({ type: 'child_pane', label: 'Advanced' })
    ).toThrow(/requires a 'childNamespace'/);
  });

  it('accepts an action_button with handler', () => {
    expect(() =>
      SpecifierSchema.parse({
        type: 'action_button',
        label: 'Send Test Email',
        handler: {
          kind: 'http',
          method: 'POST',
          url: '/api/settings/mail/test',
          body: { to: '${ctx.user.email}' },
        },
      })
    ).not.toThrow();
  });

  it('rejects an action_button without handler', () => {
    expect(() =>
      SpecifierSchema.parse({ type: 'action_button', label: 'Test' })
    ).toThrow(/requires a 'handler'/);
  });
});

describe('SettingsManifestSchema', () => {
  const minimalManifest: SettingsManifest = {
    namespace: 'mail',
    version: 1,
    label: 'Mail Delivery',
    scope: 'tenant',
    readPermission: 'setup.access',
    writePermission: 'setup.write',
    specifiers: [
      { type: 'group', label: 'Provider', required: false },
      {
        type: 'select',
        key: 'provider',
        label: 'Provider',
        required: false,
        options: [
          { value: 'smtp', label: 'SMTP' },
          { value: 'sendgrid', label: 'SendGrid' },
        ],
      },
    ],
  };

  it('accepts a minimal manifest', () => {
    const parsed = SettingsManifestSchema.parse(minimalManifest);
    expect(parsed.namespace).toBe('mail');
    expect(parsed.specifiers).toHaveLength(2);
  });

  it('applies defaults: version=1, scope=tenant, perms=setup.*', () => {
    const parsed = SettingsManifestSchema.parse({
      namespace: 'branding',
      label: 'Branding',
      specifiers: [
        { type: 'text', key: 'product_name', label: 'Product Name', required: false },
      ],
    });
    expect(parsed.version).toBe(1);
    expect(parsed.scope).toBe('tenant');
    expect(parsed.readPermission).toBe('setup.access');
    expect(parsed.writePermission).toBe('setup.write');
  });

  it('requires at least one specifier', () => {
    expect(() =>
      SettingsManifestSchema.parse({
        namespace: 'empty',
        label: 'Empty',
        specifiers: [],
      })
    ).toThrow();
  });

  it('rejects duplicate specifier keys', () => {
    expect(() =>
      SettingsManifestSchema.parse({
        namespace: 'dup',
        label: 'Dup',
        specifiers: [
          { type: 'text', key: 'foo', label: 'Foo 1', required: false },
          { type: 'text', key: 'foo', label: 'Foo 2', required: false },
        ],
      })
    ).toThrow(/Duplicate specifier key 'foo'/);
  });

  it('rejects child_pane that points at its own namespace', () => {
    expect(() =>
      SettingsManifestSchema.parse({
        namespace: 'mail',
        label: 'Mail',
        specifiers: [
          {
            type: 'child_pane',
            label: 'Recursive',
            childNamespace: 'mail',
            required: false,
          },
        ],
      })
    ).toThrow(/cannot reference its own namespace/);
  });

  it('rejects namespace with invalid characters', () => {
    expect(() =>
      SettingsManifestSchema.parse({ ...minimalManifest, namespace: 'Mail-Delivery' })
    ).toThrow();
  });

  it('accepts the Mail manifest from the ADR example', () => {
    expect(() =>
      SettingsManifestSchema.parse({
        namespace: 'mail',
        label: 'Mail Delivery',
        icon: 'mail',
        description: 'Configure outbound email transport.',
        category: 'Communication',
        specifiers: [
          { type: 'group', label: 'Provider', required: false },
          {
            type: 'select',
            key: 'provider',
            label: 'Provider',
            default: 'smtp',
            required: true,
            options: [
              { value: 'smtp', label: 'SMTP' },
              { value: 'sendgrid', label: 'SendGrid' },
              { value: 'ses', label: 'Amazon SES' },
              { value: 'resend', label: 'Resend' },
            ],
          },
          { type: 'group', label: 'SMTP', visible: "${data.provider === 'smtp'}", required: false },
          {
            type: 'text', key: 'smtp_host', label: 'Host', required: true,
            visible: "${data.provider === 'smtp'}",
          },
          {
            type: 'number', key: 'smtp_port', label: 'Port', default: 587, required: false,
            visible: "${data.provider === 'smtp'}",
            min: 1, max: 65535,
          },
          {
            type: 'password', key: 'smtp_password', label: 'Password', required: false,
            visible: "${data.provider === 'smtp'}",
          },
          { type: 'group', label: 'Identity', required: false },
          { type: 'email', key: 'from_email', label: 'From Address', required: true },
          { type: 'text',  key: 'from_name',  label: 'From Name', required: false },
          {
            type: 'action_button',
            label: 'Send Test Email',
            icon: 'send',
            required: false,
            handler: {
              kind: 'http',
              method: 'POST',
              url: '/api/settings/mail/test',
              body: { to: '${ctx.user.email}' },
            },
          },
        ],
      })
    ).not.toThrow();
  });
});

describe('ResolvedSettingValueSchema', () => {
  it('accepts each source', () => {
    for (const source of ['env', 'tenant', 'user', 'default'] as const) {
      const parsed = ResolvedSettingValueSchema.parse({
        value: 'x',
        source,
        locked: source === 'env',
      });
      expect(parsed.source).toBe(source);
    }
  });

  it('rejects unknown source', () => {
    expect(() =>
      ResolvedSettingValueSchema.parse({ value: 'x', source: 'magic', locked: false })
    ).toThrow();
  });
});

describe('SettingsNamespacePayloadSchema', () => {
  it('accepts a manifest + values bundle', () => {
    const parsed = SettingsNamespacePayloadSchema.parse({
      manifest: {
        namespace: 'mail',
        label: 'Mail',
        specifiers: [
          { type: 'text', key: 'smtp_host', label: 'Host', required: false },
        ],
      },
      values: {
        smtp_host: { value: 'smtp.example.com', source: 'tenant', locked: false },
      },
    });
    expect(parsed.values.smtp_host.value).toBe('smtp.example.com');
  });
});

describe('SettingsActionResultSchema', () => {
  it('accepts ok/message', () => {
    expect(() =>
      SettingsActionResultSchema.parse({
        ok: true,
        message: 'Test email queued',
        severity: 'success',
      })
    ).not.toThrow();
  });

  it('accepts a failure with details', () => {
    const parsed = SettingsActionResultSchema.parse({
      ok: false,
      message: 'Connection refused',
      severity: 'error',
      details: { code: 'ECONNREFUSED', host: 'smtp.example.com' },
    });
    expect(parsed.ok).toBe(false);
  });
});

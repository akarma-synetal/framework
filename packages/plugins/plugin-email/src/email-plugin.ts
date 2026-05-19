// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import type { IDataEngine } from '@objectstack/spec/contracts';
import type {
  IEmailTransport,
  EmailAddress,
} from '@objectstack/spec/contracts';
import { SysEmail, SysEmailTemplate } from '@objectstack/platform-objects/audit';
import { EmailService, LogTransport, type EmailPersistence, type TemplateLoader, type EmailTemplateRow } from './email-service.js';
import { makeTransport } from './transports/index.js';
import { BUILTIN_AUTH_TEMPLATES } from './templates/auth-templates.js';
import type { EmailTemplateDefinition as EmailTemplate } from '@objectstack/spec/system';

const SYSTEM_CTX = { isSystem: true, roles: [], permissions: [] } as const;

/**
 * Plugin configuration.
 */
export interface EmailServicePluginOptions {
  /**
   * Pluggable delivery transport. When omitted the plugin builds one
   * from `provider`/`apiKey`; if both omitted, falls back to
   * `LogTransport` (no real send).
   */
  transport?: IEmailTransport;
  /** Provider tag — `'log' | 'resend' | 'postmark'`. Default `'log'`. */
  provider?: 'log' | 'resend' | 'postmark';
  /** API key for resend/postmark. */
  apiKey?: string;
  /** Provider-specific extra options (e.g. Postmark messageStream). */
  providerOptions?: Record<string, unknown>;
  /** Default `From` address applied when `input.from` is omitted. */
  defaultFrom?: EmailAddress;
  /** Persist each attempt to sys_email. Default true when ObjectQL engine present. */
  persist?: boolean;
  /** Retry attempts on transport throw. Default 0. */
  retries?: number;
  /** Default template render context (merged into every sendTemplate call). */
  defaultTemplateContext?: Record<string, unknown>;
  /** Seed built-in auth templates into sys_email_template on startup. Default true. */
  seedTemplates?: boolean;
  /** Additional templates seeded alongside the built-ins. */
  templates?: EmailTemplate[];
}

/**
 * EmailServicePlugin — registers the `email` service.
 *
 * Lifecycle:
 *   - `init`: register sys_email + sys_email_template via manifest;
 *     build transport (config → provider+apiKey → LogTransport fallback);
 *     register a transport-only EmailService so dependents can resolve it.
 *   - `start` (kernel:ready): wire ObjectQL-backed sys_email persistence
 *     + sys_email_template TemplateLoader; seed built-in auth templates
 *     (upsert by `(name, locale)`).
 */
export class EmailServicePlugin implements Plugin {
  name = 'com.objectstack.service.email';
  version = '1.0.0';
  type = 'standard';
  dependencies = ['com.objectstack.engine.objectql'];

  private readonly options: EmailServicePluginOptions;
  private service?: EmailService;

  constructor(options: EmailServicePluginOptions = {}) {
    this.options = options;
  }

  private resolveTransport(ctx: PluginContext): IEmailTransport {
    if (this.options.transport) return this.options.transport;
    const provider = this.options.provider ?? 'log';
    if (provider === 'log') return new LogTransport(ctx.logger);
    return makeTransport({
      provider,
      apiKey: this.options.apiKey,
      options: this.options.providerOptions,
      logger: ctx.logger,
    });
  }

  async init(ctx: PluginContext): Promise<void> {
    // Register sys_email + sys_email_template via manifest service.
    ctx.getService<{ register(m: any): void }>('manifest').register({
      id: 'com.objectstack.service.email',
      name: 'Email Service',
      version: '1.0.0',
      type: 'plugin',
      scope: 'system',
      defaultDatasource: 'cloud',
      namespace: 'sys',
      objects: [SysEmail, SysEmailTemplate],
    });

    const transport = this.resolveTransport(ctx);
    if (!this.options.transport && (this.options.provider ?? 'log') === 'log') {
      ctx.logger.info(
        'EmailServicePlugin: no transport configured — using LogTransport (mail will NOT be sent)',
      );
    } else {
      ctx.logger.info(
        `EmailServicePlugin: using '${this.options.provider ?? 'log'}' provider`,
      );
    }

    // Persistence + templateLoader are wired in `start` once the
    // ObjectQL engine is available; here we register the service
    // synchronously so dependents can resolve it.
    this.service = new EmailService({
      transport,
      defaultFrom: this.options.defaultFrom,
      retries: this.options.retries,
      defaultTemplateContext: this.options.defaultTemplateContext,
      logger: ctx.logger,
    });
    ctx.registerService('email', this.service);
    ctx.logger.info('EmailServicePlugin: email service registered');
  }

  async start(ctx: PluginContext): Promise<void> {
    ctx.hook('kernel:ready', async () => {
      let engine: IDataEngine | null = null;
      try { engine = ctx.getService<IDataEngine>('objectql'); }
      catch { try { engine = ctx.getService<IDataEngine>('data'); } catch { /* ignore */ } }
      if (!engine || !this.service) return;

      const persistence: EmailPersistence | undefined = this.options.persist === false
        ? undefined
        : {
          async insert(row) {
            const created = await (engine as any).insert('sys_email', row, {
              context: SYSTEM_CTX,
            });
            return created?.id ? { id: String(created.id) } : { id: String(row.id) };
          },
          async update(id, patch) {
            await (engine as any).update('sys_email', { id, ...patch }, {
              context: SYSTEM_CTX,
            });
          },
        };

      const templateLoader: TemplateLoader = {
        async load(name, locale) {
          const where: Record<string, unknown> = { name };
          if (locale) where.locale = locale;
          const rows = await (engine as any).find('sys_email_template', {
            where,
            limit: 1,
            context: SYSTEM_CTX,
          });
          const row = Array.isArray(rows) ? rows[0] : (rows as any)?.data?.[0];
          return (row as EmailTemplateRow) || null;
        },
      };

      // Mutate the existing service instance so consumers that already
      // captured a reference (e.g. AuthManager) see the upgrade.
      if (persistence) this.service.setPersistence(persistence);
      this.service.setTemplateLoader(templateLoader);
      ctx.logger.info('EmailServicePlugin: sys_email persistence + template loader enabled');

      // Seed built-in + user-provided templates (upsert by name+locale).
      if (this.options.seedTemplates !== false) {
        const all = [
          ...BUILTIN_AUTH_TEMPLATES,
          ...(this.options.templates ?? []),
        ];
        for (const tpl of all) {
          try { await this.upsertTemplate(engine!, tpl); }
          catch (err: any) {
            console.warn('[EmailServicePlugin] seed template failed:', tpl.name, tpl.locale, err?.message || err);
          }
        }
        ctx.logger.info(`EmailServicePlugin: seeded ${all.length} template row(s)`);
      }
    });
  }

  private async upsertTemplate(engine: IDataEngine, tpl: EmailTemplate): Promise<void> {
    const row = {
      name: tpl.name,
      label: tpl.label,
      category: tpl.category,
      locale: tpl.locale,
      subject: tpl.subject,
      body_html: tpl.bodyHtml,
      ...(tpl.bodyText ? { body_text: tpl.bodyText } : {}),
      ...(tpl.fromOverride?.address ? {
        from_address: tpl.fromOverride.address,
        ...(tpl.fromOverride.name ? { from_name: tpl.fromOverride.name } : {}),
      } : {}),
      ...(tpl.replyTo ? { reply_to: tpl.replyTo } : {}),
      active: tpl.active,
      is_system: tpl.isSystem,
      ...(tpl.description ? { description: tpl.description } : {}),
      ...(tpl.variables?.length ? { variables_json: JSON.stringify(tpl.variables) } : {}),
    };
    const existing = await (engine as any).find('sys_email_template', {
      where: { name: tpl.name, locale: tpl.locale },
      limit: 1,
      context: SYSTEM_CTX,
    });
    const existingRow = Array.isArray(existing) ? existing[0] : (existing as any)?.data?.[0];
    if (existingRow?.id) {
      // Only re-seed if the existing row is system-managed (is_system=true);
      // never overwrite a tenant-customised row.
      if (existingRow.is_system === false) return;
      await (engine as any).update('sys_email_template', { id: existingRow.id, ...row }, {
        context: SYSTEM_CTX,
      });
    } else {
      await (engine as any).insert('sys_email_template', row, {
        context: SYSTEM_CTX,
      });
    }
  }
}

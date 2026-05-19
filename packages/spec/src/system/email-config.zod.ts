// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { lazySchema } from '../shared/lazy-schema';

/**
 * Email Service Configuration Protocol
 *
 * Operator-facing configuration that selects the outbound email
 * transport for the EmailServicePlugin. Provider is a `provider` tag
 * + provider-specific settings; concrete `IEmailTransport`
 * implementations live in `@objectstack/plugin-email/transports/*`.
 *
 * Resolution order in `serve.ts`:
 *   1. `config.email.*` from objectstack.config.ts
 *   2. `OS_EMAIL_*` environment variables (override per setting)
 *   3. Default → provider='log' (LogTransport, no real send)
 */

/**
 * SaaS / log transport selector.
 *
 * - `log`     — LogTransport (development / CI; no real delivery).
 * - `resend`  — Resend HTTPS API (https://resend.com).
 * - `postmark`— Postmark HTTPS API (https://postmarkapp.com).
 *
 * Self-hosted SMTP is intentionally NOT shipped in plugin-email; apps
 * that need SMTP register a custom `IEmailTransport` themselves and
 * pass it via `EmailServicePluginOptions.transport`.
 */
export const EmailProviderSchema = lazySchema(() => z.enum(['log', 'resend', 'postmark']));
export type EmailProvider = z.infer<typeof EmailProviderSchema>;

export const EmailAddressConfigSchema = lazySchema(() => z.object({
  name: z.string().optional().describe('Display name (e.g. "Acme CRM")'),
  address: z.string().email().describe('RFC-5322 address'),
}));
export type EmailAddressConfig = z.infer<typeof EmailAddressConfigSchema>;

export const EmailServiceConfigSchema = lazySchema(() => z.object({
  /**
   * Transport provider. Defaults to `'log'` so unconfigured deployments
   * still boot — but mail will not actually be delivered.
   */
  provider: EmailProviderSchema.default('log'),

  /**
   * API key for the selected provider (`resend` / `postmark`). Read
   * from `OS_EMAIL_API_KEY` env var when omitted. Ignored for `log`.
   */
  apiKey: z.string().optional().describe('Provider API key (or OS_EMAIL_API_KEY env)'),

  /**
   * Default `From` address used when a `send()` call omits `from`.
   * Required for any non-`log` provider; without it every send fails
   * VALIDATION_FAILED. `OS_EMAIL_FROM` env (`name <addr>` syntax)
   * supplies this when config is omitted.
   */
  defaultFrom: EmailAddressConfigSchema.optional(),

  /** Number of retry attempts on transport failure. Default 0. */
  retries: z.number().int().min(0).max(10).optional().describe('Retry attempts on transport throw'),

  /**
   * Persist each delivery attempt to `sys_email`. Default true; set
   * false for high-volume or PII-sensitive deployments that route
   * audit through their own pipeline.
   */
  persist: z.boolean().optional().describe('Persist to sys_email (default true)'),

  /**
   * Provider-specific extras (e.g. Postmark `messageStream`). Free-form
   * object the transport may consume.
   */
  options: z.record(z.string(), z.unknown()).optional(),
}));
export type EmailServiceConfig = z.infer<typeof EmailServiceConfigSchema>;

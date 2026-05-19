// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { IEmailTransport } from '@objectstack/spec/contracts';
import { LogTransport } from '../email-service.js';
import { ResendTransport } from './resend.js';
import { PostmarkTransport } from './postmark.js';

export { ResendTransport, type ResendTransportOptions } from './resend.js';
export { PostmarkTransport, type PostmarkTransportOptions } from './postmark.js';

export interface MakeTransportOptions {
  provider: 'log' | 'resend' | 'postmark';
  apiKey?: string;
  options?: Record<string, unknown>;
  logger?: { info: (msg: string, meta?: any) => void };
}

/**
 * Build an IEmailTransport from a provider tag + opts. Used by
 * EmailServicePlugin to materialise the transport selected by
 * `EmailServiceConfig.provider`.
 *
 * Throws when a non-`log` provider is requested without an `apiKey`.
 */
export function makeTransport(opts: MakeTransportOptions): IEmailTransport {
  const { provider, apiKey, options = {}, logger } = opts;
  switch (provider) {
    case 'log':
      return new LogTransport(logger);
    case 'resend':
      if (!apiKey) throw new Error("makeTransport: provider='resend' requires apiKey (OS_EMAIL_API_KEY)");
      return new ResendTransport({ apiKey, ...(options as any) });
    case 'postmark':
      if (!apiKey) throw new Error("makeTransport: provider='postmark' requires apiKey (OS_EMAIL_API_KEY)");
      return new PostmarkTransport({ apiKey, ...(options as any) });
    default:
      throw new Error(`makeTransport: unknown provider '${provider}'`);
  }
}

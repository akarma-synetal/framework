// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  IEmailTransport,
  NormalizedEmailMessage,
  TransportSendResult,
} from '@objectstack/spec/contracts';

/**
 * ResendTransport — SaaS delivery via https://resend.com
 *
 * Implements `IEmailTransport` using the Resend HTTPS API. Zero
 * external dependencies (uses fetch). API docs:
 * https://resend.com/docs/api-reference/emails/send-email
 *
 * @example
 * ```ts
 * new EmailServicePlugin({
 *   transport: new ResendTransport(process.env.RESEND_API_KEY!),
 *   defaultFrom: { name: 'Acme', address: 'no-reply@acme.com' },
 * });
 * ```
 */
export interface ResendTransportOptions {
  apiKey: string;
  /** Override the API host (used by tests / proxies). */
  endpoint?: string;
}

export class ResendTransport implements IEmailTransport {
  private readonly apiKey: string;
  private readonly endpoint: string;

  constructor(apiKeyOrOptions: string | ResendTransportOptions) {
    if (typeof apiKeyOrOptions === 'string') {
      this.apiKey = apiKeyOrOptions;
      this.endpoint = 'https://api.resend.com/emails';
    } else {
      this.apiKey = apiKeyOrOptions.apiKey;
      this.endpoint = apiKeyOrOptions.endpoint || 'https://api.resend.com/emails';
    }
    if (!this.apiKey) {
      throw new Error('ResendTransport: apiKey is required');
    }
  }

  async send(message: NormalizedEmailMessage): Promise<TransportSendResult> {
    const body: Record<string, unknown> = {
      from: message.from,
      to: message.to,
      subject: message.subject,
    };
    if (message.html !== undefined) body.html = message.html;
    if (message.text !== undefined) body.text = message.text;
    if (message.cc?.length) body.cc = message.cc;
    if (message.bcc?.length) body.bcc = message.bcc;
    if (message.replyTo) body.reply_to = message.replyTo;
    if (message.headers && Object.keys(message.headers).length > 0) body.headers = message.headers;
    if (message.attachments?.length) {
      body.attachments = message.attachments.map((a) => ({
        filename: a.filename,
        content: typeof a.content === 'string'
          ? a.content
          : (a.content as any)?.toString?.('base64') ?? String(a.content),
        ...(a.contentType ? { content_type: a.contentType } : {}),
      }));
    }

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Resend ${res.status}: ${errText.slice(0, 500)}`);
    }
    const json = await res.json().catch(() => ({} as any));
    const messageId = String((json as any)?.id ?? '');
    if (!messageId) {
      throw new Error('Resend: response missing `id` field');
    }
    return { messageId, response: 'resend:ok' };
  }
}

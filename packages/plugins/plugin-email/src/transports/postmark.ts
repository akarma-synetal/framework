// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  IEmailTransport,
  NormalizedEmailMessage,
  TransportSendResult,
} from '@objectstack/spec/contracts';

/**
 * PostmarkTransport — SaaS delivery via https://postmarkapp.com
 *
 * Implements `IEmailTransport` using the Postmark HTTPS API. Zero
 * external dependencies (uses fetch). API docs:
 * https://postmarkapp.com/developer/user-guide/send-email-with-api
 *
 * @example
 * ```ts
 * new EmailServicePlugin({
 *   transport: new PostmarkTransport({
 *     apiKey: process.env.POSTMARK_TOKEN!,
 *     messageStream: 'outbound',
 *   }),
 *   defaultFrom: { name: 'Acme', address: 'no-reply@acme.com' },
 * });
 * ```
 */
export interface PostmarkTransportOptions {
  apiKey: string;
  /** Postmark message stream (default 'outbound'). */
  messageStream?: string;
  /** Override the API host. */
  endpoint?: string;
}

export class PostmarkTransport implements IEmailTransport {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly messageStream: string;

  constructor(opts: PostmarkTransportOptions) {
    if (!opts?.apiKey) throw new Error('PostmarkTransport: apiKey is required');
    this.apiKey = opts.apiKey;
    this.endpoint = opts.endpoint || 'https://api.postmarkapp.com/email';
    this.messageStream = opts.messageStream || 'outbound';
  }

  async send(message: NormalizedEmailMessage): Promise<TransportSendResult> {
    const body: Record<string, unknown> = {
      From: message.from,
      To: message.to.join(', '),
      Subject: message.subject,
      MessageStream: this.messageStream,
    };
    if (message.html !== undefined) body.HtmlBody = message.html;
    if (message.text !== undefined) body.TextBody = message.text;
    if (message.cc?.length) body.Cc = message.cc.join(', ');
    if (message.bcc?.length) body.Bcc = message.bcc.join(', ');
    if (message.replyTo) body.ReplyTo = message.replyTo;
    if (message.headers && Object.keys(message.headers).length > 0) {
      body.Headers = Object.entries(message.headers).map(([Name, Value]) => ({ Name, Value }));
    }
    if (message.attachments?.length) {
      body.Attachments = message.attachments.map((a) => ({
        Name: a.filename,
        Content: typeof a.content === 'string'
          ? a.content
          : (a.content as any)?.toString?.('base64') ?? String(a.content),
        ContentType: a.contentType || 'application/octet-stream',
        ...(a.cid ? { ContentID: `cid:${a.cid}` } : {}),
      }));
    }

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Postmark ${res.status}: ${errText.slice(0, 500)}`);
    }
    const json: any = await res.json().catch(() => ({}));
    const messageId = String(json?.MessageID ?? '');
    if (!messageId) {
      throw new Error('Postmark: response missing `MessageID` field');
    }
    return { messageId, response: 'postmark:ok' };
  }
}

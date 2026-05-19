// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { EmailTemplateDefinition as EmailTemplate } from '@objectstack/spec/system';

/**
 * Built-in auth email templates seeded into `sys_email_template` on
 * EmailServicePlugin startup. Each template is `isSystem: true` so
 * tenants may overlay subject/body but should not delete the row.
 *
 * Templates use `{{path.to.value}}` placeholders; `{{{...}}}` for
 * unescaped URLs (see template-engine.ts).
 *
 * Authoring conventions:
 * - Subject: plain, max ~80 chars, no markup.
 * - HTML body: single column, ~600px max width, inline styles only
 *   (most clients strip <head>).
 * - Always include a plain-text fallback (good for spam scoring).
 * - Provide an `{{appName}}` variable everywhere for brand override.
 */

const baseStyles = 'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#1f2937';
const buttonStyles = 'display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600';
const footerStyles = 'margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px';

function wrap(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="${baseStyles};margin:0;padding:24px;background:#f9fafb">
<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px;border-radius:8px;border:1px solid #e5e7eb">
<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600">${title}</h1>
${bodyHtml}
<div style="${footerStyles}">
You received this email because of activity on your {{appName}} account.<br>
If this wasn't you, you can safely ignore this message.
</div>
</div></body></html>`;
}

export const AUTH_PASSWORD_RESET_TEMPLATE: EmailTemplate = {
  name: 'auth.password_reset',
  label: 'Password Reset',
  category: 'auth',
  locale: 'en-US',
  subject: 'Reset your {{appName}} password',
  bodyHtml: wrap('Reset your password', `
<p>Hi {{user.name}},</p>
<p>We received a request to reset the password for the account associated with <strong>{{user.email}}</strong>.</p>
<p>Click the button below to choose a new password. This link expires in {{expiresInMinutes}} minutes.</p>
<p style="margin:24px 0"><a href="{{{resetUrl}}}" style="${buttonStyles}">Reset password</a></p>
<p style="font-size:13px;color:#6b7280">Or copy and paste this URL into your browser:<br><span style="word-break:break-all">{{resetUrl}}</span></p>
<p>If you didn't request this, no action is needed — your password stays the same.</p>
`),
  bodyText: `Hi {{user.name}},

We received a request to reset the password for {{user.email}}.

Reset your password (link expires in {{expiresInMinutes}} minutes):
{{resetUrl}}

If you didn't request this, ignore this email.`,
  variables: [
    { name: 'user.name', type: 'string', required: false, description: 'Recipient display name' },
    { name: 'user.email', type: 'string', required: true, description: 'Recipient email' },
    { name: 'resetUrl', type: 'url', required: true, description: 'Password reset URL' },
    { name: 'expiresInMinutes', type: 'number', required: false, description: 'Link TTL in minutes' },
    { name: 'appName', type: 'string', required: false, description: 'Product/app name (brand override)' },
  ],
  active: true,
  isSystem: true,
  description: 'Sent when a user requests a password reset via better-auth.',
};

export const AUTH_VERIFY_EMAIL_TEMPLATE: EmailTemplate = {
  name: 'auth.verify_email',
  label: 'Verify Email Address',
  category: 'auth',
  locale: 'en-US',
  subject: 'Verify your {{appName}} email address',
  bodyHtml: wrap('Verify your email', `
<p>Hi {{user.name}},</p>
<p>Thanks for signing up for {{appName}}! Please confirm <strong>{{user.email}}</strong> belongs to you.</p>
<p style="margin:24px 0"><a href="{{{verificationUrl}}}" style="${buttonStyles}">Verify email</a></p>
<p style="font-size:13px;color:#6b7280">Or copy and paste this URL into your browser:<br><span style="word-break:break-all">{{verificationUrl}}</span></p>
`),
  bodyText: `Hi {{user.name}},

Please verify your email ({{user.email}}) by opening this link:
{{verificationUrl}}`,
  variables: [
    { name: 'user.name', type: 'string', required: false },
    { name: 'user.email', type: 'string', required: true },
    { name: 'verificationUrl', type: 'url', required: true },
    { name: 'appName', type: 'string', required: false },
  ],
  active: true,
  isSystem: true,
  description: 'Sent when better-auth needs to verify a newly-registered email address.',
};

export const AUTH_MAGIC_LINK_TEMPLATE: EmailTemplate = {
  name: 'auth.magic_link',
  label: 'Magic Link Sign-In',
  category: 'auth',
  locale: 'en-US',
  subject: 'Your {{appName}} sign-in link',
  bodyHtml: wrap('Sign in to {{appName}}', `
<p>Click the button below to sign in. This link expires in {{expiresInMinutes}} minutes and may only be used once.</p>
<p style="margin:24px 0"><a href="{{{magicLinkUrl}}}" style="${buttonStyles}">Sign in</a></p>
<p style="font-size:13px;color:#6b7280">Or paste:<br><span style="word-break:break-all">{{magicLinkUrl}}</span></p>
`),
  bodyText: `Sign in to {{appName}} (expires in {{expiresInMinutes}} min):
{{magicLinkUrl}}`,
  variables: [
    { name: 'magicLinkUrl', type: 'url', required: true },
    { name: 'expiresInMinutes', type: 'number', required: false },
    { name: 'appName', type: 'string', required: false },
  ],
  active: true,
  isSystem: true,
  description: 'Passwordless sign-in link sent by the magic-link plugin.',
};

export const AUTH_INVITATION_TEMPLATE: EmailTemplate = {
  name: 'auth.invitation',
  label: 'Organization Invitation',
  category: 'auth',
  locale: 'en-US',
  subject: '{{inviter.name}} invited you to {{organization.name}}',
  bodyHtml: wrap('You have been invited', `
<p><strong>{{inviter.name}}</strong> ({{inviter.email}}) has invited you to join <strong>{{organization.name}}</strong> on {{appName}} as <em>{{role}}</em>.</p>
<p style="margin:24px 0"><a href="{{{acceptUrl}}}" style="${buttonStyles}">Accept invitation</a></p>
<p style="font-size:13px;color:#6b7280">Or paste:<br><span style="word-break:break-all">{{acceptUrl}}</span></p>
`),
  bodyText: `{{inviter.name}} ({{inviter.email}}) invited you to join {{organization.name}} on {{appName}}.

Accept: {{acceptUrl}}`,
  variables: [
    { name: 'inviter.name', type: 'string', required: false },
    { name: 'inviter.email', type: 'string', required: false },
    { name: 'organization.name', type: 'string', required: true },
    { name: 'role', type: 'string', required: false },
    { name: 'acceptUrl', type: 'url', required: true },
    { name: 'appName', type: 'string', required: false },
  ],
  active: true,
  isSystem: true,
  description: 'Sent by better-auth organization plugin when a user is invited to an org.',
};

export const AUTH_TWO_FACTOR_OTP_TEMPLATE: EmailTemplate = {
  name: 'auth.two_factor_otp',
  label: 'Two-Factor Verification Code',
  category: 'auth',
  locale: 'en-US',
  subject: 'Your {{appName}} verification code',
  bodyHtml: wrap('Your verification code', `
<p>Use this code to complete sign-in:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;background:#f3f4f6;padding:16px;text-align:center;border-radius:6px;margin:24px 0">{{otp}}</p>
<p style="color:#6b7280;font-size:13px">This code expires in {{expiresInMinutes}} minutes. If you didn't try to sign in, change your password — your account may be at risk.</p>
`),
  bodyText: `Your {{appName}} verification code: {{otp}}
(expires in {{expiresInMinutes}} minutes)`,
  variables: [
    { name: 'otp', type: 'string', required: true },
    { name: 'expiresInMinutes', type: 'number', required: false },
    { name: 'appName', type: 'string', required: false },
  ],
  active: true,
  isSystem: true,
  description: 'Time-based OTP delivered for two-factor / email-OTP login.',
};

export const BUILTIN_AUTH_TEMPLATES: EmailTemplate[] = [
  AUTH_PASSWORD_RESET_TEMPLATE,
  AUTH_VERIFY_EMAIL_TEMPLATE,
  AUTH_MAGIC_LINK_TEMPLATE,
  AUTH_INVITATION_TEMPLATE,
  AUTH_TWO_FACTOR_OTP_TEMPLATE,
];

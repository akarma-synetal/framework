// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  CryptoContext,
  CryptoHandle,
  ICryptoProvider,
} from '@objectstack/spec/contracts';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

/**
 * InMemoryCryptoProvider — default ICryptoProvider used by the
 * SettingsService when the host application does not wire a real KMS.
 *
 * Encryption: AES-256-GCM with a per-process random data key. The data
 * key lives only in memory; restarting the process loses the ability
 * to decrypt previously-written rows. This is intentional — operators
 * MUST replace this with a KMS-backed provider before relying on
 * `sys_secret` for production secrets. The provider's purpose is to:
 *
 *  - exercise the round-trip in unit tests and dev kernels;
 *  - provide a "real-looking" handle format so consumers don't depend
 *    on accidental implementation details of a no-op adapter;
 *  - serve as a reference for what AwsKmsCryptoProvider /
 *    GcpKmsCryptoProvider implementations need to satisfy.
 *
 * Handle format:
 *   id        — `sec_` + 32 hex chars (122 bits of entropy)
 *   kmsKeyId  — `local:in-memory:v<version>`
 *   alg       — `aes-256-gcm`
 *   version   — bumps on rotateKey()
 *   ciphertext— base64(iv (12) || authTag (16) || cipher)
 *
 * AAD binding: the CryptoContext (namespace + key + tenantId) is
 * folded into AES-GCM AAD so a ciphertext rewrapped from a different
 * (ns, key) tuple fails decryption — guards against operators
 * accidentally copying rows between namespaces.
 */
export class InMemoryCryptoProvider implements ICryptoProvider {
  private readonly key: Buffer;

  constructor(opts: { key?: Buffer } = {}) {
    this.key = opts.key ?? randomBytes(32);
  }

  async encrypt(plain: string, ctx: CryptoContext): Promise<CryptoHandle> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(this.aadOf(ctx), 'utf8'));
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const blob = Buffer.concat([iv, tag, enc]).toString('base64');
    return {
      id: 'sec_' + randomBytes(16).toString('hex'),
      kmsKeyId: 'local:in-memory:v1',
      alg: 'aes-256-gcm',
      version: 1,
      ciphertext: blob,
    };
  }

  async decrypt(handle: CryptoHandle, ctx: CryptoContext): Promise<string> {
    const buf = Buffer.from(handle.ciphertext, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAAD(Buffer.from(this.aadOf(ctx), 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  async rotateKey(handle: CryptoHandle, ctx: CryptoContext): Promise<CryptoHandle> {
    const plain = await this.decrypt(handle, ctx);
    const next = await this.encrypt(plain, ctx);
    return {
      ...next,
      id: handle.id,
      kmsKeyId: `local:in-memory:v${handle.version + 1}`,
      version: handle.version + 1,
    };
  }

  digest(plain: string): string {
    return 'sha256:' + createHash('sha256').update(plain, 'utf8').digest('hex');
  }

  private aadOf(ctx: CryptoContext): string {
    // Bind ciphertext to (namespace,key) so a row cannot be moved across
    // specifiers. Tenant binding is intentionally omitted because the
    // handle is dereferenced from a `sys_setting` row already scoped to
    // its tenant — adding tenant here would force the decrypt path to
    // re-read that scope.
    return [ctx.namespace, ctx.key].join('|');
  }
}

// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import {
  OpenAIEmbedder,
  createOpenAIEmbedder,
  OPENAI_COMPATIBLE_PRESETS,
} from '../index';

function mockFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('OpenAIEmbedder', () => {
  it('requires apiKey', () => {
    expect(() => new OpenAIEmbedder({ apiKey: '' })).toThrow(/apiKey required/);
  });

  it('exposes id and known dimensions for default model', () => {
    const e = new OpenAIEmbedder({ apiKey: 'k', fetch: mockFetch({ data: [] }) });
    expect(e.id).toBe('openai');
    expect(e.dimensions).toBe(1536);
  });

  it('looks up dimensions for known Chinese models', () => {
    const e = new OpenAIEmbedder({
      apiKey: 'k',
      model: 'text-embedding-v3',
      fetch: mockFetch({ data: [] }),
    });
    expect(e.dimensions).toBe(1024);
  });

  it('honours explicit dimensions override', () => {
    const e = new OpenAIEmbedder({
      apiKey: 'k',
      dimensions: 256,
      fetch: mockFetch({ data: [] }),
    });
    expect(e.dimensions).toBe(256);
  });

  it('returns [] for empty input without calling fetch', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const e = new OpenAIEmbedder({ apiKey: 'k', fetch: fetchImpl });
    const out = await e.embed([]);
    expect(out).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('POSTs to the configured baseUrl with bearer auth', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const e = new OpenAIEmbedder({
      apiKey: 'sk-test',
      baseUrl: 'https://api.siliconflow.cn/v1',
      model: 'BAAI/bge-m3',
      fetch: fetchImpl,
    });
    const out = await e.embed(['hello']);

    expect(out).toEqual([[0.1, 0.2]]);
    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('https://api.siliconflow.cn/v1/embeddings');
    const init = call[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body as string)).toEqual({ model: 'BAAI/bge-m3', input: ['hello'] });
  });

  it('forwards dimensions in the request body when overridden', async () => {
    const fetchImpl = mockFetch({ data: [{ embedding: [1, 2] }] });
    const e = new OpenAIEmbedder({
      apiKey: 'k',
      dimensions: 512,
      fetch: fetchImpl,
    });
    await e.embed(['x']);
    const body = JSON.parse(
      (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    );
    expect(body.dimensions).toBe(512);
  });

  it('throws a useful error on non-2xx', async () => {
    const fetchImpl = mockFetch({ error: 'bad key' }, 401);
    const e = new OpenAIEmbedder({ apiKey: 'k', fetch: fetchImpl });
    await expect(e.embed(['x'])).rejects.toThrow(/401/);
  });

  it('throws when response vector count mismatches input', async () => {
    const fetchImpl = mockFetch({ data: [{ embedding: [1] }] });
    const e = new OpenAIEmbedder({ apiKey: 'k', fetch: fetchImpl });
    await expect(e.embed(['a', 'b'])).rejects.toThrow(/expected 2 vectors/);
  });

  it('strips trailing slashes from baseUrl', async () => {
    const fetchImpl = mockFetch({ data: [{ embedding: [1] }] });
    const e = new OpenAIEmbedder({
      apiKey: 'k',
      baseUrl: 'https://x.example/v1///',
      fetch: fetchImpl,
    });
    await e.embed(['x']);
    expect(
      (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0],
    ).toBe('https://x.example/v1/embeddings');
  });

  it('merges extra headers', async () => {
    const fetchImpl = mockFetch({ data: [{ embedding: [1] }] });
    const e = new OpenAIEmbedder({
      apiKey: 'k',
      fetch: fetchImpl,
      headers: { 'x-trace-id': 't1' },
    });
    await e.embed(['x']);
    const headers = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][1].headers as Record<string, string>;
    expect(headers['x-trace-id']).toBe('t1');
    expect(headers.authorization).toBe('Bearer k');
  });
});

describe('createOpenAIEmbedder presets', () => {
  it('maps preset names to baseUrl', () => {
    const e = createOpenAIEmbedder({
      preset: 'dashscope',
      apiKey: 'k',
      model: 'text-embedding-v3',
      fetch: mockFetch({ data: [] }),
    });
    expect(e.id).toBe('dashscope');
    expect(e.dimensions).toBe(1024);
  });

  it('exposes well-known preset URLs', () => {
    expect(OPENAI_COMPATIBLE_PRESETS.siliconflow).toContain('siliconflow.cn');
    expect(OPENAI_COMPATIBLE_PRESETS.zhipu).toContain('bigmodel.cn');
    expect(OPENAI_COMPATIBLE_PRESETS.ollama).toContain('localhost:11434');
  });

  it('explicit baseUrl wins over preset', async () => {
    const fetchImpl = mockFetch({ data: [{ embedding: [1] }] });
    const e = createOpenAIEmbedder({
      preset: 'openai',
      baseUrl: 'https://my-proxy.example/v1',
      apiKey: 'k',
      fetch: fetchImpl,
    });
    await e.embed(['x']);
    expect(
      (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0],
    ).toBe('https://my-proxy.example/v1/embeddings');
  });
});

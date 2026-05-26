// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `IEmbedder` — protocol-level contract for text → vector providers.
 *
 * Implemented by embedder plugins (`@objectstack/embedder-openai`,
 * `@objectstack/embedder-ollama`, `@objectstack/embedder-transformers-js`,
 * …) and consumed by every knowledge adapter that needs to compute
 * vectors (e.g. `@objectstack/knowledge-turso`,
 * `@objectstack/knowledge-sqlite-vec`).
 *
 * The surface is deliberately minimal so the same protocol covers
 * cloud APIs (OpenAI, 阿里通义, 智谱, 硅基流动, Doubao, …), local
 * Ollama daemons, in-process WASM/ONNX runtimes, and any OpenAI-shape
 * compatible endpoint. Implementations are responsible for batching,
 * retry, and rate-limit handling against their upstream.
 *
 * Conventions:
 *  - Output order MUST match input order exactly.
 *  - Vectors SHOULD be L2-normalised so downstream cosine == dot.
 *  - `dimensions` MUST be stable for the lifetime of the instance —
 *    knowledge adapters size their vector columns from this value.
 *
 * See `content/docs/protocol/knowledge.mdx`.
 */
export interface IEmbedder {
  /** Stable id for logs and diagnostics (e.g. `'openai'`, `'ollama'`). */
  readonly id: string;
  /**
   * Output vector dimensionality. Knowledge adapters use this to size
   * their fixed-width vector columns / index parameters.
   */
  readonly dimensions: number;
  /**
   * Embed a batch of strings. Output order matches input order.
   * Implementations SHOULD handle empty input by returning `[]`.
   */
  embed(texts: string[]): Promise<number[][]>;
}

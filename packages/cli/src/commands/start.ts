// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Command, Flags } from '@oclif/core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { printHeader, printKV, printStep, printError } from '../utils/format.js';

export default class Start extends Command {
  static override description = 'Serve the pre-compiled artifact in production mode (no objectstack.config.ts required; OS_ARTIFACT_PATH may be a file path or http(s):// URL)';

  static override flags = {
    ui: Flags.boolean({ description: 'Enable Studio UI at /_studio/' }),
    verbose: Flags.boolean({ char: 'v', description: 'Verbose output' }),
    port: Flags.integer({ char: 'p', description: 'Port to listen on' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Start);

    printHeader('Production Mode');

    const artifactPathInput = process.env.OS_ARTIFACT_PATH
      ?? path.resolve(process.cwd(), 'dist/objectstack.json');

    // `OS_ARTIFACT_PATH` is allowed to be an `http(s)://` URL — the
    // runtime's loadArtifactBundle() can fetch JSON over the network.
    // Skip the existence check for URLs (validated lazily by the loader).
    const isUrl = /^https?:\/\//i.test(artifactPathInput);
    const artifactPath = isUrl ? artifactPathInput : path.resolve(process.cwd(), artifactPathInput);

    if (!isUrl && !fs.existsSync(artifactPath)) {
      printError(`Artifact not found: ${path.relative(process.cwd(), artifactPath)}`);
      console.error('  Run \x1b[33mobjectstack build\x1b[0m to compile your configuration first,');
      console.error('  or set \x1b[33mOS_ARTIFACT_PATH\x1b[0m to a file path or http(s):// URL.');
      process.exit(1);
    }

    const displayPath = isUrl ? artifactPath : path.relative(process.cwd(), artifactPath);
    printKV('Artifact', displayPath, '📦');
    printStep('Starting server (production mode)...');

    const localEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: 'production',
      OS_PROJECT_ID: process.env.OS_PROJECT_ID ?? 'proj_local',
      OS_ARTIFACT_PATH: process.env.OS_ARTIFACT_PATH ?? artifactPath,
      ...(flags.port ? { PORT: String(flags.port) } : {}),
    };

    printKV('Project ID', localEnv.OS_PROJECT_ID!, '🎯');

    const binPath = process.argv[1];
    spawn(
      process.execPath,
      [
        binPath,
        'serve',
        ...(flags.ui ? ['--ui'] : []),
        ...(flags.verbose ? ['--verbose'] : []),
      ],
      { stdio: 'inherit', env: localEnv },
    );
  }
}

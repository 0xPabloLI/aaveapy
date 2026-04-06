#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';

import { runIconManifestGenerators } from './lib/run-icon-manifest-generators.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

runIconManifestGenerators({
  nodeExecutable: process.execPath,
  rootDir: ROOT,
});

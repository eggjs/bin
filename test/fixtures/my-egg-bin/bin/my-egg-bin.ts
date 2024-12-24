#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from '@artus-cli/artus-cli';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.join(__dirname, '..');

console.error(baseDir);

start({
  baseDir,
});

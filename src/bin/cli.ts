#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from '@artus-cli/artus-cli';

function getCurrentFilename() {
  if (typeof __filename === 'string') {
    return __filename;
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return fileURLToPath(import.meta.url);
}

function main() {
  const currentFilename = getCurrentFilename();
  // src/bin/cli.ts => src/
  let baseDir = path.dirname(path.dirname(currentFilename));
  const isBuildJavascriptFile = getCurrentFilename().endsWith('.js');
  const exclude = [ 'scripts', 'bin', 'test', 'coverage' ];
  if (isBuildJavascriptFile) {
    // dist/esm/bin/cli.js => dist/
    baseDir = path.dirname(baseDir);
    exclude.push('*.ts');
  } else {
    exclude.push('dist');
  }

  start({
    binName: 'egg-bin',
    exclude,
    baseDir,
  });
}

main();

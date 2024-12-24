import path from 'node:path';
import fs from 'node:fs/promises';
import { DefineCommand, Option } from '@artus-cli/artus-cli';
import { importResolve } from '@eggjs/utils';
import { TestCommand } from './test.js';

@DefineCommand({
  command: 'cov [files...]',
  description: 'Run the test with coverage',
  alias: [ 'c' ],
})
export class CovCommand extends TestCommand {
  // will use on egg-mock https://github.com/eggjs/egg-mock/blob/84a64bd19d0569ec94664c898fb1b28367b95d60/index.js#L7
  @Option({
    description: 'prerequire files for coverage instrument',
    type: 'boolean',
    default: false,
  })
  prerequire: boolean;

  @Option({
    description: 'coverage ignore, one or more files patterns`',
    array: true,
    default: [],
  })
  x: string[];

  @Option({
    description: 'c8 instruments passthrough`',
    default: '--temp-directory node_modules/.c8_output -r text-summary -r json-summary -r json -r lcov -r cobertura',
  })
  c8: string;

  get defaultExcludes() {
    return [
      'example/',
      'examples/',
      'mocks**/',
      'docs/',
      // https://github.com/JaKXz/test-exclude/blob/620a7be412d4fc2070d50f0f63e3228314066fc9/index.js#L73
      'test/**',
      'test{,-*}.js',
      '**/*.test.js',
      '**/__tests__/**',
      '**/node_modules/**',
      'typings',
      '**/*.d.ts',
    ];
  }

  protected async forkNode(modulePath: string, args: string[]) {
    if (this.prerequire) {
      this.ctx.env.EGG_BIN_PREREQUIRE = 'true';
    }
    // append cobertura
    if (this.c8) {
      this.c8 += ' -r cobertura';
    }

    // add c8 args
    // https://github.com/eggjs/egg/issues/3930
    const c8Args = [
      // '--show-process-tree',
      ...this.c8.split(' ').filter(a => a.trim()),
    ];
    if (this.ctx.args.typescript) {
      this.ctx.env.SPAWN_WRAP_SHIM_ROOT = path.join(this.base, 'node_modules');
      c8Args.push('--extension');
      c8Args.push('.ts');
    }

    const excludes = new Set([
      ...process.env.COV_EXCLUDES?.split(',') ?? [],
      ...this.defaultExcludes,
      ...this.x,
    ]);
    for (const exclude of excludes) {
      c8Args.push('-x');
      c8Args.push(exclude);
    }
    const c8File = importResolve('c8/bin/c8.js');
    const outputDir = path.join(this.base, 'node_modules/.c8_output');
    await fs.rm(outputDir, { force: true, recursive: true });
    const coverageDir = path.join(this.base, 'coverage');
    await fs.rm(coverageDir, { force: true, recursive: true });

    await super.forkNode(c8File, [ ...c8Args, process.execPath, ...this.ctx.args.execArgv || [], modulePath, ...args ]);
  }
}

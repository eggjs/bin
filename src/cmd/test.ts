import { debuglog } from 'node:util';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DefineCommand, Option,
} from '@artus-cli/artus-cli';
import globby from 'globby';
import { importResolve } from '@eggjs/utils';
import { getChangedFilesForRoots } from 'jest-changed-files';
import { BaseCommand } from './base.js';

const debug = debuglog('egg-bin:test');

@DefineCommand({
  command: 'test [files...]',
  description: 'Run the test',
  alias: [ 't' ],
})
export class TestCommand extends BaseCommand {
  @Option({
    default: [],
    array: true,
    type: 'string',
  })
  files: string[];

  @Option({
    description: 'set test-case timeout in milliseconds, default is 60000',
    alias: 't',
    default: process.env.TEST_TIMEOUT ?? 60000,
  })
  timeout: number | boolean;

  @Option({
    description: 'only run tests matching <pattern>',
    alias: 'g',
    type: 'string',
    array: true,
    default: [],
  })
  grep: string[];

  @Option({
    description: 'only test with changed files and match test/**/*.test.(js|ts), default is false',
    alias: 'c',
    type: 'boolean',
    default: false,
  })
  changed: boolean;

  @Option({
    description: 'mocha parallel mode, default is false',
    alias: 'p',
    type: 'boolean',
    default: false,
  })
  parallel: boolean;

  @Option({
    description: 'number of jobs to run in parallel',
    type: 'number',
    default: os.cpus().length - 1,
  })
  jobs: number;

  @Option({
    description: 'auto bootstrap agent in mocha master process, default is true',
    type: 'boolean',
    default: true,
  })
  autoAgent: boolean;

  @Option({
    description: 'enable mochawesome reporter, default is true',
    type: 'boolean',
    default: true,
  })
  mochawesome: boolean;

  @Option({
    description: 'bbort ("bail") after first test failure',
    alias: 'b',
    type: 'boolean',
    default: false,
  })
  bail: boolean;

  async run() {
    try {
      await fs.access(this.base);
    } catch (err) {
      console.error('baseDir: %o not exists', this.base);
      throw err;
    }

    const mochaFile = process.env.MOCHA_FILE || importResolve('mocha/bin/_mocha');
    if (this.parallel) {
      this.ctx.env.ENABLE_MOCHA_PARALLEL = 'true';
      if (this.autoAgent) {
        this.ctx.env.AUTO_AGENT = 'true';
      }
    }
    // set NODE_ENV=test, let egg application load unittest logic
    // https://eggjs.org/basics/env#difference-from-node_env
    this.ctx.env.NODE_ENV = 'test';
    debug('run test: %s %o', mochaFile, this.ctx.args);

    const mochaArgs = await this.formatMochaArgs();
    if (!mochaArgs) return;
    await this.forkNode(mochaFile, mochaArgs, {
      execArgv: [
        ...process.execArgv,
        // https://github.com/mochajs/mocha/issues/2640#issuecomment-1663388547
        '--unhandled-rejections=strict',
      ],
    });
  }

  protected async formatMochaArgs() {
    // collect require
    const requires = await this.formatRequires();
    try {
      const eggMockRegister = importResolve('@eggjs/mock/register', { paths: [ this.base ] });
      requires.push(eggMockRegister);
      debug('auto register @eggjs/mock/register: %o', eggMockRegister);
    } catch (err) {
      // ignore @eggjs/mock not exists
      debug('auto register @eggjs/mock fail, can not require @eggjs/mock on %o, error: %s',
        this.base, (err as Error).message);
    }

    // handle mochawesome enable
    let reporter = this.ctx.env.TEST_REPORTER;
    let reporterOptions = '';
    if (!reporter && this.mochawesome) {
      // use https://github.com/node-modules/mochawesome/pull/1 instead
      reporter = importResolve('mochawesome-with-mocha');
      reporterOptions = 'reportDir=node_modules/.mochawesome-reports';
      if (this.parallel) {
        // https://github.com/adamgruber/mochawesome#parallel-mode
        requires.push(importResolve('mochawesome-with-mocha/register'));
      }
    }

    const ext = this.ctx.args.typescript ? 'ts' : 'js';
    let pattern = this.files;
    // changed
    if (this.changed) {
      pattern = await this.getChangedTestFiles(this.base, ext);
      if (!pattern.length) {
        console.log('No changed test files');
        return;
      }
      debug('changed files: %o', pattern);
    }

    if (!pattern.length && process.env.TESTS) {
      pattern = process.env.TESTS.split(',');
    }

    // collect test files when nothing is changed
    if (!pattern.length) {
      pattern = [ `test/**/*.test.${ext}` ];
    }
    pattern = pattern.concat([ '!test/fixtures', '!test/node_modules' ]);

    // expand glob and skip node_modules and fixtures
    const files = globby.sync(pattern, { cwd: this.base });
    files.sort();

    if (files.length === 0) {
      console.log(`No test files found with ${pattern}`);
      return;
    }

    // auto add setup file as the first test file
    const setupFile = path.join(this.base, `test/.setup.${ext}`);
    try {
      await fs.access(setupFile);
      files.unshift(setupFile);
    } catch {
      // ignore
    }

    return [
      this.dryRun ? '--dry-run' : '',
      // force exit
      '--exit',
      this.bail ? '--bail' : '',
      this.grep.map(pattern => `--grep='${pattern}'`).join(' '),
      this.timeout === false ? '--no-timeout' : `--timeout=${this.timeout}`,
      this.parallel ? '--parallel' : '',
      this.parallel && this.jobs ? `--jobs=${this.jobs}` : '',
      reporter ? `--reporter=${reporter}` : '',
      reporterOptions ? `--reporter-options=${reporterOptions}` : '',
      ...requires.map(r => `--require=${r}`),
      ...files,
    ].filter(a => a.trim());
  }

  protected async getChangedTestFiles(dir: string, ext: string) {
    const res = await getChangedFilesForRoots([ path.join(dir, 'test') ], {});
    const changedFiles = res.changedFiles;
    const files: string[] = [];
    for (let cf of changedFiles) {
      // only find test/**/*.test.(js|ts)
      if (cf.endsWith(`.test.${ext}`)) {
        // Patterns MUST use forward slashes (not backslashes)
        // This should be converted on Windows
        if (process.platform === 'win32') {
          cf = cf.replace(/\\/g, '/');
        }
        files.push(cf);
      }
    }
    return files;
  }
}

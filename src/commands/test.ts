import { debuglog } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { Args, Flags } from '@oclif/core';
import globby from 'globby';
import { importResolve } from '@eggjs/utils';
import { BaseCommand } from '../baseCommand.js';

const debug = debuglog('@eggjs/bin/commands/test');

export default class Test extends BaseCommand<typeof Test> {
  static override args = {
    file: Args.string({
      description: 'file(s) to test',
    }),
  };

  static override description = 'Run the test';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> test/index.test.ts',
    '<%= config.bin %> <%= command.id %> --json',
    '<%= config.bin %> <%= command.id %> --log-level debug',
  ];

  static override flags = {
    bail: Flags.boolean({
      description: 'bbort ("bail") after first test failure',
      default: false,
      char: 'b',
    }),
    timeout: Flags.integer({
      char: 't',
      description: 'set test-case timeout in milliseconds',
      default: parseInt(process.env.TEST_TIMEOUT ?? '60000'),
    }),
    'no-timeout': Flags.boolean({
      description: 'disable timeout',
    }),
    grep: Flags.string({
      char: 'g',
      description: 'only run tests matching <pattern>',
    }),
    mochawesome: Flags.boolean({
      description: '[default: true] enable mochawesome reporter',
      default: true,
      allowNo: true,
    }),
    parallel: Flags.boolean({
      description: 'mocha parallel mode',
      default: false,
      char: 'p',
    }),
    jobs: Flags.integer({
      char: 't',
      description: 'number of jobs to run in parallel',
      default: os.cpus().length - 1,
    }),
    'auto-agent': Flags.boolean({
      description: '[default: true] auto bootstrap agent in mocha master process',
      default: true,
      allowNo: true,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = this;

    try {
      await fs.access(flags.base);
    } catch (err) {
      console.error('baseDir: %o not exists', flags.base);
      throw err;
    }

    const mochaFile = process.env.MOCHA_FILE || importResolve('mocha/bin/_mocha');
    if (flags.parallel) {
      this.env.ENABLE_MOCHA_PARALLEL = 'true';
      if (flags['auto-agent']) {
        this.env.AUTO_AGENT = 'true';
      }
    }
    // set NODE_ENV=test, let egg application load unittest logic
    // https://eggjs.org/basics/env#difference-from-node_env
    this.env.NODE_ENV = 'test';

    if (flags['no-timeout']) {
      flags.timeout = 0;
    }
    debug('run test: %s %o flags: %o', mochaFile, this.args, flags);

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
    const { args, flags } = this;
    // collect require
    const requires = await this.formatRequires();
    // try {
    //   const eggMockRegister = importResolve('@eggjs/mock/register', { paths: [ this.base ] });
    //   requires.push(eggMockRegister);
    //   debug('auto register @eggjs/mock/register: %o', eggMockRegister);
    // } catch (err) {
    //   // ignore @eggjs/mock not exists
    //   debug('auto register @eggjs/mock fail, can not require @eggjs/mock on %o, error: %s',
    //     this.base, (err as Error).message);
    // }

    // handle mochawesome enable
    let reporter = this.env.TEST_REPORTER;
    let reporterOptions = '';
    if (!reporter && flags.mochawesome) {
      // use https://github.com/node-modules/mochawesome/pull/1 instead
      reporter = importResolve('mochawesome-with-mocha');
      reporterOptions = 'reportDir=node_modules/.mochawesome-reports';
      if (flags.parallel) {
        // https://github.com/adamgruber/mochawesome#parallel-mode
        requires.push(path.join(reporter, '../register.js'));
      }
    }

    const ext = flags.typescript ? 'ts' : 'js';
    let pattern = args.file ? args.file.split(',') : [];
    // // changed
    // if (this.changed) {
    //   pattern = await this.getChangedTestFiles(this.base, ext);
    //   if (!pattern.length) {
    //     console.log('No changed test files');
    //     return;
    //   }
    //   debug('changed files: %o', pattern);
    // }

    if (!pattern.length && process.env.TESTS) {
      pattern = process.env.TESTS.split(',');
    }

    // collect test files when nothing is changed
    if (!pattern.length) {
      pattern = [ `test/**/*.test.${ext}` ];
    }
    pattern = pattern.concat([ '!test/fixtures', '!test/node_modules' ]);

    // expand glob and skip node_modules and fixtures
    const files = globby.sync(pattern, { cwd: flags.base });
    files.sort();

    if (files.length === 0) {
      console.log(`No test files found with ${pattern}`);
      return;
    }

    // auto add setup file as the first test file
    const setupFile = path.join(flags.base, `test/.setup.${ext}`);
    try {
      await fs.access(setupFile);
      files.unshift(setupFile);
    } catch {
      // ignore
    }

    const grep = flags.grep ? flags.grep.split(',') : [];

    return [
      flags['dry-run'] ? '--dry-run' : '',
      // force exit
      '--exit',
      flags.bail ? '--bail' : '',
      grep.map(pattern => `--grep='${pattern}'`).join(' '),
      flags.timeout ? `--timeout=${flags.timeout}` : '--no-timeout',
      flags.parallel ? '--parallel' : '',
      flags.parallel && flags.jobs ? `--jobs=${flags.jobs}` : '',
      reporter ? `--reporter=${reporter}` : '',
      reporterOptions ? `--reporter-options=${reporterOptions}` : '',
      ...requires.map(r => `--require=${r}`),
      ...files,
    ].filter(a => a.trim());
  }
}
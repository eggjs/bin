import { debuglog } from 'node:util';
import path from 'node:path';
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
      default: 'test/**/*.test.ts',
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
    // flag with no value (--ts, --typescript)
    typescript: Flags.boolean({
      description: '[default: true] use TypeScript to run the test',
      default: true,
      aliases: [ 'ts' ],
      allowNo: true,
    }),
    javascript: Flags.boolean({
      description: 'use JavaScript to run the test',
      default: false,
      aliases: [ 'js' ],
    }),
    bail: Flags.boolean({
      description: 'bbort ("bail") after first test failure',
      default: false,
      char: 'b',
    }),
    // flag with a value (-n, --name=VALUE)
    timeout: Flags.string({
      char: 't',
      description: 'set test-case timeout in milliseconds',
      default: process.env.TEST_TIMEOUT ?? '60000',
    }),
    grep: Flags.string({
      char: 'g',
      description: 'only run tests matching <pattern>',
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
    // if (this.parallel) {
    //   this.ctx.env.ENABLE_MOCHA_PARALLEL = 'true';
    //   if (this.autoAgent) {
    //     this.ctx.env.AUTO_AGENT = 'true';
    //   }
    // }
    // set NODE_ENV=test, let egg application load unittest logic
    // https://eggjs.org/basics/env#difference-from-node_env
    // this.ctx.env.NODE_ENV = 'test';
    debug('run test: %s %o', mochaFile, this.args);

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
    // let reporter = this.ctx.env.TEST_REPORTER;
    // let reporterOptions = '';
    // if (!reporter && this.mochawesome) {
    //   // use https://github.com/node-modules/mochawesome/pull/1 instead
    //   reporter = importResolve('mochawesome-with-mocha');
    //   reporterOptions = 'reportDir=node_modules/.mochawesome-reports';
    //   if (this.parallel) {
    //     // https://github.com/adamgruber/mochawesome#parallel-mode
    //     requires.push(importResolve('mochawesome-with-mocha/register'));
    //   }
    // }

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
      flags.dryRun ? '--dry-run' : '',
      // force exit
      '--exit',
      flags.bail ? '--bail' : '',
      grep.map(pattern => `--grep='${pattern}'`).join(' '),
      flags.timeout ? `--timeout=${flags.timeout}` : '--no-timeout',
      // this.parallel ? '--parallel' : '',
      // this.parallel && this.jobs ? `--jobs=${this.jobs}` : '',
      // reporter ? `--reporter=${reporter}` : '',
      // reporterOptions ? `--reporter-options=${reporterOptions}` : '',
      ...requires.map(r => `--require=${r}`),
      ...files,
    ].filter(a => a.trim());
  }
}

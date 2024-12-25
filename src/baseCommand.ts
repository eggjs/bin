import { debuglog } from 'node:util';
// import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fork, ForkOptions, ChildProcess } from 'node:child_process';
import { Command, Flags, Interfaces } from '@oclif/core';
import { importResolve } from '@eggjs/utils';
import {
  addNodeOptionsToEnv,
  getSourceDirname,
  // readPackageJSON, hasTsConfig, getSourceFilename,
} from './utils.js';

const debug = debuglog('@eggjs/bin/baseCommand');

// only hook once and only when ever start any child.
const children = new Set<ChildProcess>();
let hadHook = false;
function graceful(proc: ChildProcess) {
  // save child ref
  children.add(proc);

  // only hook once
  /* c8 ignore else */
  if (!hadHook) {
    hadHook = true;
    let signal: NodeJS.Signals;
    [ 'SIGINT', 'SIGQUIT', 'SIGTERM' ].forEach(event => {
      process.once(event, () => {
        signal = event as NodeJS.Signals;
        process.exit(0);
      });
    });

    process.once('exit', (code: number) => {
      for (const child of children) {
        debug('process exit code: %o, kill child %o with %o', code, child.pid, signal);
        child.kill(signal);
      }
    });
  }
}

class ForkError extends Error {
  code: number | null;
  constructor(message: string, code: number | null) {
    super(message);
    this.code = code;
  }
}

export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof BaseCommand['baseFlags'] & T['flags']>;
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>;

export abstract class BaseCommand<T extends typeof Command> extends Command {
  // add the --json flag
  static enableJsonFlag = false;

  // define flags that can be inherited by any command that extends BaseCommand
  static baseFlags = {
    // 'log-level': Flags.option({
    //   default: 'info',
    //   helpGroup: 'GLOBAL',
    //   options: ['debug', 'warn', 'error', 'info', 'trace'] as const,
    //   summary: 'Specify level for logging.',
    // })(),
    dryRun: Flags.boolean({
      default: false,
      helpGroup: 'GLOBAL',
      summary: 'whether show full command script only',
      char: 'd',
    }),
    require: Flags.string({
      helpGroup: 'GLOBAL',
      summary: 'require the given module',
      char: 'r',
      multiple: true,
    }),
    base: Flags.string({
      helpGroup: 'GLOBAL',
      summary: 'directory of application, default to `process.cwd()`',
      aliases: [ 'baseDir' ],
      default: process.cwd(),
    }),
  };

  protected flags!: Flags<T>;
  protected args!: Args<T>;

  protected env = process.env;

  public async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      args: this.ctor.args,
      strict: this.ctor.strict,
    });
    this.flags = flags as Flags<T>;
    this.args = args as Args<T>;

    // use ts-node/esm loader on esm
    let esmLoader = importResolve('ts-node/esm', {
      paths: [ getSourceDirname() ],
    });
    // ES Module loading with absolute path fails on windows
    // https://github.com/nodejs/node/issues/31710#issuecomment-583916239
    // https://nodejs.org/api/url.html#url_url_pathtofileurl_path
    // Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only URLs with a scheme in: file, data, and node are supported by the default ESM loader. On Windows, absolute paths must be valid file:// URLs. Received protocol 'd:'
    esmLoader = pathToFileURL(esmLoader).href;
    // wait for https://github.com/nodejs/node/issues/40940
    addNodeOptionsToEnv('--no-warnings', this.env);
    addNodeOptionsToEnv(`--loader ${esmLoader}`, this.env);
  }

  protected async catch(err: Error & {exitCode?: number}): Promise<any> {
    // add any custom logic to handle errors from the command
    // or simply return the parent class error handling
    return super.catch(err);
  }

  protected async finally(_: Error | undefined): Promise<any> {
    // called after run and catch regardless of whether or not the command errored
    return super.finally(_);
  }

  protected async formatRequires(): Promise<string[]> {
    const requires = this.args.require ?? [];
    // const eggRequire = this.args.pkgEgg.require;
    // if (Array.isArray(eggRequire)) {
    //   for (const r of eggRequire) {
    //     requires.push(r);
    //   }
    // } else if (typeof eggRequire === 'string' && eggRequire) {
    //   requires.push(eggRequire);
    // }
    return requires;
  }

  protected async forkNode(modulePath: string, forkArgs: string[], options: ForkOptions = {}) {
    const { args } = this;
    if (args.dryRun) {
      console.log('dry run: $ %o', `${process.execPath} ${modulePath} ${args.join(' ')}`);
      return;
    }
    const forkExecArgv = [
      // ...this.ctx.args.execArgv || [],
      ...options.execArgv || [],
    ];

    options = {
      stdio: 'inherit',
      env: this.env,
      cwd: args.base,
      ...options,
      execArgv: forkExecArgv,
    };
    const proc = fork(modulePath, forkArgs, options);
    debug('Run fork pid: %o\n\n$ %s%s %s %s\n\n',
      proc.pid,
      options.env?.NODE_OPTIONS ? `NODE_OPTIONS='${options.env.NODE_OPTIONS}' ` : '',
      process.execPath,
      modulePath, forkArgs.map(a => `'${a}'`).join(' '));
    graceful(proc);

    return new Promise<void>((resolve, reject) => {
      proc.once('exit', code => {
        debug('fork pid: %o exit code %o', proc.pid, code);
        children.delete(proc);
        if (code !== 0) {
          const err = new ForkError(modulePath + ' ' + forkArgs.join(' ') + ' exit with code ' + code, code);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}


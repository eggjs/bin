import { debuglog } from 'node:util';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  Inject, ApplicationLifecycle, LifecycleHook, LifecycleHookUnit,
  Program, CommandContext,
} from '@artus-cli/artus-cli';
import { importResolve } from '@eggjs/utils';
import { runScript } from 'runscript';
import {
  addNodeOptionsToEnv,
  getSourceDirname,
  readPackageJSON, hasTsConfig, getSourceFilename,
} from '../utils.js';

const debug = debuglog('@eggjs/bin/middleware/global_options');

@LifecycleHookUnit()
export default class GlobalOptions implements ApplicationLifecycle {
  @Inject()
  private readonly program: Program;

  @LifecycleHook()
  async configDidLoad() {
    // add global options
    this.program.option({
      base: {
        description: 'directory of application, default to `process.cwd()`',
        type: 'string',
        alias: 'baseDir',
      },
      declarations: {
        description: 'whether create typings, will add `--require egg-ts-helper/register`',
        type: 'boolean',
        alias: 'dts',
      },
      typescript: {
        description: 'whether enable typescript support',
        type: 'boolean',
        alias: 'ts',
      },
      tscompiler: {
        description: 'ts compiler, like ts-node/register, ts-node/register/transpile-only, @swc-node/register, esbuild-register etc',
        type: 'string',
        alias: 'tsc',
      },
    });

    this.program.use(async (ctx: CommandContext, next) => {
      debug('before next');
      if (!ctx.args.base) {
        ctx.args.base = ctx.cwd;
        debug('ctx.args.base not set, auto set it to cwd: %o', ctx.cwd);
      }
      if (!path.isAbsolute(ctx.args.base)) {
        ctx.args.base = path.join(ctx.cwd, ctx.args.base);
      }
      debug('matched cmd: %o, ctx.args.base: %o', ctx.matched?.cmd, ctx.args.base);
      const pkg = await readPackageJSON(ctx.args.base);
      ctx.args.pkgEgg = pkg.egg ?? {};
      const tscompiler = ctx.args.tscompiler ?? ctx.env.TS_COMPILER ?? ctx.args.pkgEgg.tscompiler;
      if (ctx.args.typescript === undefined) {
        // try to ready EGG_TYPESCRIPT env first, only accept 'true' or 'false' string
        if (ctx.env.EGG_TYPESCRIPT === 'false') {
          ctx.args.typescript = false;
          debug('detect typescript=%o from EGG_TYPESCRIPT=%o', false, ctx.env.EGG_TYPESCRIPT);
        } else if (ctx.env.EGG_TYPESCRIPT === 'true') {
          ctx.args.typescript = true;
          debug('detect typescript=%o from EGG_TYPESCRIPT=%o', true, ctx.env.EGG_TYPESCRIPT);
        } else if (typeof ctx.args.pkgEgg.typescript === 'boolean') {
          // read `egg.typescript` from package.json if not pass argv
          ctx.args.typescript = ctx.args.pkgEgg.typescript;
          debug('detect typescript=%o from pkg.egg.typescript=%o', true, ctx.args.pkgEgg.typescript);
        } else if (pkg.dependencies?.typescript) {
          // auto detect pkg.dependencies.typescript or pkg.devDependencies.typescript
          ctx.args.typescript = true;
          debug('detect typescript=%o from pkg.dependencies.typescript=%o', true, pkg.dependencies.typescript);
        } else if (pkg.devDependencies?.typescript) {
          ctx.args.typescript = true;
          debug('detect typescript=%o from pkg.devDependencies.typescript=%o', true, pkg.devDependencies.typescript);
        } else if (await hasTsConfig(ctx.args.base)) {
          // tsconfig.json exists
          ctx.args.typescript = true;
          debug('detect typescript=%o cause tsconfig.json exists', true);
        } else if (tscompiler) {
          ctx.args.typescript = true;
          debug('detect typescript=%o from --tscompiler=%o', true, tscompiler);
        }
      }

      const isESM = pkg.type === 'module';
      if (ctx.args.typescript) {
        const findPaths = [ getSourceFilename('middleware') ];
        if (tscompiler) {
          // try app baseDir first on custom tscompiler
          findPaths.unshift(ctx.args.base);
        }
        ctx.args.tscompiler = tscompiler ?? 'ts-node/register';
        const tsNodeRegister = importResolve(ctx.args.tscompiler, {
          paths: findPaths,
        });
        // should require tsNodeRegister on current process, let it can require *.ts files
        // e.g.: dev command will execute egg loader to find configs and plugins
        // await importModule(tsNodeRegister);
        // let child process auto require ts-node too
        if (isESM) {
          addNodeOptionsToEnv(`--import ${tsNodeRegister}`, ctx.env);
        } else {
          addNodeOptionsToEnv(`--require ${tsNodeRegister}`, ctx.env);
        }
        // addNodeOptionsToEnv(`--require ${tsNodeRegister}`, ctx.env);
        // tell egg loader to load ts file
        // see https://github.com/eggjs/egg-core/blob/master/lib/loader/egg_loader.js#L443
        ctx.env.EGG_TYPESCRIPT = 'true';
        // set current process.env.EGG_TYPESCRIPT too
        process.env.EGG_TYPESCRIPT = 'true';
        // load files from tsconfig on startup
        ctx.env.TS_NODE_FILES = process.env.TS_NODE_FILES ?? 'true';
        // keep same logic with egg-core, test cmd load files need it
        // see https://github.com/eggjs/egg-core/blob/master/lib/loader/egg_loader.js#L49
        // addNodeOptionsToEnv(`--require ${importResolve('tsconfig-paths/register', {
        //   paths: [ getSourceDirname() ],
        // })}`, ctx.env);
      }
      if (isESM) {
        // use ts-node/esm loader on esm
        let esmLoader = importResolve('ts-node/esm', {
          paths: [ getSourceDirname() ],
        });
        if (process.platform === 'win32') {
          // ES Module loading with absolute path fails on windows
          // https://github.com/nodejs/node/issues/31710#issuecomment-583916239
          // https://nodejs.org/api/url.html#url_url_pathtofileurl_path
          esmLoader = pathToFileURL(esmLoader).href;
        }
        // wait for https://github.com/nodejs/node/issues/40940
        addNodeOptionsToEnv('--no-warnings', ctx.env);
        addNodeOptionsToEnv(`--loader ${esmLoader}`, ctx.env);
      }

      if (ctx.args.declarations === undefined) {
        if (typeof ctx.args.pkgEgg.declarations === 'boolean') {
          // read `egg.declarations` from package.json if not pass argv
          ctx.args.declarations = ctx.args.pkgEgg.declarations;
          debug('detect declarations from pkg.egg.declarations=%o', ctx.args.pkgEgg.declarations);
        }
      }
      if (ctx.args.declarations) {
        const etsBin = importResolve('egg-ts-helper/dist/bin');
        debug('run ets first: %o', etsBin);
        await runScript(`node ${etsBin}`);
      }

      if (ctx.args.pkgEgg.revert) {
        ctx.args.execArgv = ctx.args.execArgv || [];
        const reverts = Array.isArray(ctx.args.pkgEgg.revert) ? ctx.args.pkgEgg.revert : [ ctx.args.pkgEgg.revert ];
        for (const revert of reverts) {
          ctx.args.execArgv.push(`--security-revert=${revert}`);
        }
      }

      debug('set NODE_OPTIONS: %o', ctx.env.NODE_OPTIONS);
      debug('ctx.args: %o', ctx.args);
      debug('enter next');
      await next();
      debug('after next');
    });
  }
}

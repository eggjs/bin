import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs/promises';
import runscript from 'runscript';
import coffee from './coffee';

async function cpy(src: string, target: string) {
  await fs.cp(src, target, { force: true, recursive: true });
}

describe('test/ts.test.ts', () => {
  const eggBin = path.join(__dirname, '../src/bin/cli.ts');
  const fixtures = path.join(__dirname, 'fixtures');
  let cwd: string;

  it('should support ts', () => {
    cwd = path.join(fixtures, 'ts');
    return coffee.fork(eggBin, [ 'dev' ], { cwd, env: { NODE_ENV: 'development' } })
      // .debug()
      .expect('stdout', /options.typescript=true/)
      .expect('stdout', /started/)
      .expect('code', 0)
      .end();
  });

  it('should support ts test', () => {
    cwd = path.join(fixtures, 'ts');
    return coffee.fork(eggBin, [ 'test', '--typescript' ], { cwd, env: { NODE_ENV: 'development' } })
      // .debug()
      .expect('stdout', /'egg from ts' == 'wrong assert ts'/)
      .end((err, { stdout, code }) => {
        assert(err);
        assert(stdout.match(/AssertionError/));
        assert(code === 1);
      });
  });

  describe('real application', () => {
    before(() => {
      cwd = path.join(fixtures, 'example-ts');
    });

    it('should start app', () => {
      return coffee.fork(eggBin, [ 'dev' ], { cwd })
        // .debug()
        .expect('stdout', /hi, egg, 12345/)
        .expect('stdout', /ts env: true/)
        .expect('stdout', /started/)
        .expect('code', 0)
        .end();
    });

    it('should test app', () => {
      return coffee.fork(eggBin, [ 'test' ], { cwd })
        // .debug()
        .expect('stdout', /hi, egg, 123456/)
        .expect('stdout', /ts env: true/)
        .expect('stdout', /should work/)
        .expect('code', 0)
        .end();
    });

    it('should cov app', () => {
      return coffee.fork(eggBin, [ 'cov' ], { cwd })
        // .debug()
        .expect('stdout', /hi, egg, 123456/)
        .expect('stdout', /ts env: true/)
        .expect('stdout', /should work/)
        .expect('code', 0)
        .end();
    });

    it('should cov app in cluster mod', () => {
      // skip on darwin
      // https://github.com/eggjs/egg-bin/runs/6735190362?check_suite_focus=true
      // [agent_worker] receive disconnect event on child_process fork mode, exiting with code:110
      if (process.platform === 'darwin') return;
      cwd = path.join(fixtures, 'example-ts-cluster');
      return coffee.fork(eggBin, [ 'cov' ], { cwd })
        // .debug()
        .expect('stdout', /Statements/)
        .expect('code', 0)
        .end();
    });
  });

  describe('error stacks', () => {
    before(() => {
      cwd = path.join(fixtures, 'example-ts-error-stack');
    });

    it('should correct error stack line number in starting app', () => {
      return coffee.fork(eggBin, [ 'dev' ], { cwd, env: { THROW_ERROR: 'true' } })
        // .debug()
        .expect('stderr', /Error: throw error/)
        .expect('stderr', /at \w+ \(.+app\.ts:7:11\)/)
        .end();
    });

    it('should correct error stack line number in testing app', () => {
      return coffee.fork(eggBin, [ 'test' ], { cwd })
        // .debug()
        .expect('stdout', /error/)
        .expect('stdout', /2 failing/)
        .expect('stdout', /test[\/\\]index\.test\.ts:\d+:\d+\)/)
        .expect('stdout', /AssertionError \[ERR_ASSERTION]: '111' == '222'/)
        .end();
    });

    it('should correct error stack line number in testing app with tscompiler=esbuild-register', () => {
      return coffee.fork(eggBin, [ 'test', '--tscompiler=esbuild-register' ], { cwd })
        // .debug()
        .expect('stdout', /error/)
        .expect('stdout', /2 failing/)
        .expect('stdout', /test[\/\\]index\.test\.ts:\d+:\d+\)/)
        .expect('stdout', /AssertionError \[ERR_ASSERTION]: '111' == '222'/)
        .end();
    });

    it('should correct error stack line number in testing app with tscompiler=@swc-node/register', () => {
      return coffee.fork(eggBin, [ 'test', '--tscompiler=@swc-node/register' ], { cwd })
        // .debug()
        .expect('stdout', /error/)
        .expect('stdout', /2 failing/)
        .expect('stdout', /test[\/\\]index\.test\.ts:\d+:\d+\)/)
        .expect('stdout', /AssertionError \[ERR_ASSERTION]: '111' == '222'/)
        .end();
    });

    it('should support env.TS_COMPILER', () => {
      return coffee.fork(eggBin, [ 'test' ], {
        cwd,
        env: {
          TS_COMPILER: 'esbuild-register',
          NODE_DEBUG: 'egg-bin*',
        },
      })
        // .debug()
        .expect('stdout', /error/)
        .expect('stdout', /2 failing/)
        .expect('stdout', /test[\/\\]index\.test\.ts:\d+:\d+\)/)
        .expect('stdout', /AssertionError \[ERR_ASSERTION]: '111' == '222'/)
        .end((err, { stdout, code }) => {
          assert(err);
          assert(stdout.match(/AssertionError/));
          assert(code === 1);
        });
    });

    it('should correct error stack line number in covering app', () => {
      return coffee.fork(eggBin, [ 'test' ], { cwd })
        // .debug()
        .expect('stdout', /error/)
        .expect('stdout', /2 failing/)
        .expect('stdout', /test[\/\\]index\.test\.ts:\d+:\d+\)/)
        .expect('stdout', /AssertionError \[ERR_ASSERTION]: '111' == '222'/)
        .end();
    });

    it('should correct error stack line number in mixed app', () => {
      const cwd = path.join(fixtures, 'example-ts-error-stack-mixed');
      const testFile = path.resolve(cwd, 'test/index.test.js');
      return coffee.fork(eggBin, [ 'test', testFile ], { cwd })
        // .debug()
        .expect('stdout', /error/)
        .expect('stdout', /2 failing/)
        .expect('stdout', /test[\/\\]index\.test\.js:\d+:\d+\)/)
        .expect('stdout', /AssertionError \[ERR_ASSERTION]: '111' == '222'/)
        .end();
    });
  });

  describe('egg.typescript = true', () => {
    const tempNodeModules = path.join(fixtures, 'node_modules');
    const tempPackageJson = path.join(fixtures, 'package.json');
    afterEach(async () => {
      await fs.rm(tempNodeModules, { force: true, recursive: true });
      await fs.rm(tempPackageJson, { force: true, recursive: true });
    });

    before(() => {
      cwd = path.join(fixtures, 'example-ts-pkg');
    });

    it('should start app', () => {
      return coffee.fork(eggBin, [ 'dev' ], { cwd })
        // .debug()
        .expect('stdout', /hi, egg, 12345/)
        .expect('stdout', /ts env: true/)
        .expect('stdout', /started/)
        .expect('code', 0)
        .end();
    });

    it('should fail start app with --no-ts', () => {
      return coffee.fork(eggBin, [ 'dev', '--no-ts' ], { cwd })
        // .debug()
        .expect('stdout', /agent.options.typescript = false/)
        .expect('stdout', /started/)
        .expect('code', 0)
        .end();
    });

    it('should start app with flags in app without eggInfo', async () => {
      const cwd = path.join(fixtures, 'example-ts-simple');
      await coffee.fork(eggBin, [ 'dev' ], { cwd })
        // .debug()
        .expect('stdout', /started/)
        .expect('code', 0)
        .end();

      await coffee.fork(eggBin, [ 'dev', '--tsc=esbuild-register' ], { cwd })
        // .debug()
        .expect('stdout', /started/)
        .expect('code', 0)
        .end();
    });

    it('should load custom ts compiler', async () => {
      const cwd = path.join(fixtures, 'example-ts-custom-compiler');

      // install custom ts-node
      await fs.rm(path.join(cwd, 'node_modules'), { force: true, recursive: true });
      if (process.env.CI) {
        // dont use npmmirror.com on CI
        await runscript('npx npminstall', { cwd });
      } else {
        await runscript('npx cnpm install', { cwd });
      }

      // copy egg to node_modules
      await cpy(
        path.join(fixtures, 'example-ts-cluster/node_modules/egg'),
        path.join(cwd, './node_modules/egg'),
      );

      const { stderr, code } = await coffee.fork(eggBin, [ 'dev', '--tsc', 'ts-node/register' ], {
        cwd,
        env: {
          NODE_DEBUG: 'egg-bin*',
        },
      })
        // .debug()
        .end();
      assert.match(stderr, /ts-node@10\.9\.0/);
      assert.equal(code, 0);
    });

    it('should load custom ts compiler with tscompiler args', async () => {
      const cwd = path.join(fixtures, 'example-ts-custom-compiler-2');

      // install custom ts-node
      await fs.rm(path.join(cwd, 'node_modules'), { force: true, recursive: true });
      if (process.env.CI) {
        // dont use npmmirror.com on CI
        await runscript('npx npminstall ts-node@10.9.0 --no-save', { cwd });
      } else {
        await runscript('npx cnpm install ts-node@10.9.0 --no-save', { cwd });
      }

      // copy egg to node_modules
      await cpy(
        path.join(fixtures, 'example-ts-cluster/node_modules/egg'),
        path.join(cwd, './node_modules/egg'),
      );

      const { stderr, code } = await coffee.fork(eggBin, [
        'dev', '--ts', '--tscompiler=ts-node/register',
      ], {
        cwd,
        env: {
          NODE_DEBUG: 'egg-bin*',
        },
      })
        // .debug()
        .end();
      assert.match(stderr, /ts-node@10\.9\.0/);
      assert.equal(code, 0);
    });

    it('should not load custom ts compiler without tscompiler args', async () => {
      const cwd = path.join(fixtures, 'example-ts-custom-compiler-2');

      // install custom ts-node
      await fs.rm(path.join(cwd, 'node_modules'), { force: true, recursive: true });
      if (process.env.CI) {
        // dont use npmmirror.com on CI
        await runscript('npx npminstall ts-node@10.9.0 --no-save', { cwd });
      } else {
        await runscript('npx cnpm install ts-node@10.9.0 --no-save', { cwd });
      }

      // copy egg to node_modules
      await cpy(
        path.join(fixtures, 'example-ts-cluster/node_modules/egg'),
        path.join(cwd, './node_modules/egg'),
      );

      const { stderr, code } = await coffee.fork(eggBin, [ 'dev' ], {
        cwd,
        env: {
          NODE_DEBUG: 'egg-bin*',
        },
      })
        // .debug()
        .end();
      assert.doesNotMatch(stderr, /ts-node@10\.9\.0/);
      assert.equal(code, 0);
    });

    it('should start app with other tscompiler without error', () => {
      return coffee.fork(eggBin, [ 'dev', '--tscompiler=esbuild-register' ], {
        cwd: path.join(fixtures, 'example-ts'),
      })
        // .debug()
        .expect('stdout', /agent.options.typescript = true/)
        .expect('stdout', /agent.options.tscompiler =/)
        .expect('stdout', /esbuild-register/)
        .expect('stdout', /started/)
        .expect('code', 0)
        .end();
    });

    it('should skip ts-node on env.EGG_TYPESCRIPT="false"', () => {
      return coffee.fork(eggBin, [ 'dev', '--tscompiler=esbuild-register' ], {
        cwd: path.join(fixtures, 'example-ts'),
        env: {
          EGG_TYPESCRIPT: 'false',
        },
      })
        // .debug()
        .expect('stdout', /agent.options.typescript = false/)
        .expect('stdout', /agent.options.tscompiler =/)
        .expect('stdout', /esbuild-register/)
        .expect('stdout', /started/)
        .expect('code', 0)
        .end();
    });

    it('should enable ts-node on env.EGG_TYPESCRIPT="true"', () => {
      return coffee.fork(eggBin, [ 'dev', '--tscompiler=esbuild-register' ], {
        cwd: path.join(fixtures, 'example-ts'),
        env: {
          EGG_TYPESCRIPT: 'true',
        },
      })
        // .debug()
        .expect('stdout', /agent.options.typescript = true/)
        .expect('stdout', /agent.options.tscompiler =/)
        .expect('stdout', /esbuild-register/)
        .expect('stdout', /started/)
        .expect('code', 0)
        .end();
    });

    it('should start app with other tscompiler in package.json without error', () => {
      return coffee.fork(eggBin, [ 'dev' ], {
        cwd: path.join(fixtures, 'example-ts-pkg'),
      })
        // .debug()
        .expect('stdout', /agent.options.typescript = true/)
        .expect('stdout', /agent.options.tscompiler =/)
        .expect('stdout', /esbuild-register/)
        .expect('stdout', /started/)
        .expect('code', 0)
        .end();
    });

    it('should test app', () => {
      return coffee.fork(eggBin, [ 'test' ], { cwd })
        // .debug()
        .expect('stdout', /hi, egg, 123456/)
        .expect('stdout', /ts env: true/)
        .expect('code', 0)
        .end();
    });

    it('should test with custom ts compiler without error', async () => {
      const cwd = path.join(fixtures, 'example-ts-custom-compiler');

      // install custom ts-node
      await fs.rm(path.join(cwd, 'node_modules'), { force: true, recursive: true });
      if (process.env.CI) {
        // dont use npmmirror.com on CI
        await runscript('npx npminstall', { cwd });
      } else {
        await runscript('npx cnpm install', { cwd });
      }

      // copy egg to node_modules
      await cpy(
        path.join(__dirname, './fixtures/example-ts-cluster/node_modules/egg'),
        path.join(cwd, './node_modules/egg'),
      );

      const { stdout, code } = await coffee.fork(eggBin, [ 'test', '--tsc', 'ts-node/register' ], {
        cwd,
        env: {
          NODE_DEBUG: 'egg-bin*',
        },
      })
        // .debug()
        .end();
      assert.match(stdout, /ts-node@10\.9\.0/);
      assert.equal(code, 0);
    });

    it('should cov app', () => {
      return coffee.fork(eggBin, [ 'cov' ], { cwd })
        // .debug()
        .expect('stdout', /hi, egg, 123456/)
        .expect('stdout', /ts env: true/)
        .expect('code', 0)
        .end();
    });
  });
});

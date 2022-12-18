const path = require('path');
const coffee = require('coffee');
const mm = require('mm');
const fs = require('fs');
const cpy = require('cpy');
const { execSync } = require('child_process');
const os = require('os');
const assert = require('assert');

describe('test/ts.test.js', () => {
  const eggBin = require.resolve('../bin/egg-bin');
  let cwd;

  afterEach(mm.restore);

  it('should support ts', () => {
    cwd = path.join(__dirname, './fixtures/ts');
    mm(process.env, 'NODE_ENV', 'development');
    return coffee.fork(eggBin, [ 'dev', '--typescript' ], { cwd })
      // .debug()
      .expect('stdout', /options.typescript=true/)
      .expect('stdout', /started/)
      .expect('code', 0)
      .end();
  });

  it('should support ts test', () => {
    if (process.platform === 'win32') return;

    cwd = path.join(__dirname, './fixtures/ts');
    mm(process.env, 'NODE_ENV', 'development');
    return coffee.fork(eggBin, [ 'test', '--typescript' ], { cwd })
      // .debug()
      .expect('stdout', /The expression evaluated to a falsy value/)
      .expect('code', 1)
      .end();
  });

  describe('real application', () => {
    if (process.env.EGG_VERSION && process.env.EGG_VERSION === '1') {
      console.log('skip egg@1');
      return;
    }

    before(() => {
      cwd = path.join(__dirname, './fixtures/example-ts');
    });

    it('should start app', () => {
      return coffee.fork(eggBin, [ 'dev', '--ts' ], { cwd })
        // .debug()
        .expect('stdout', /hi, egg, 12345/)
        .expect('stdout', /ts env: true/)
        .expect('stdout', /started/)
        .expect('code', 0)
        .end();
    });

    it('should test app', () => {
      return coffee.fork(eggBin, [ 'test', '--ts' ], { cwd })
        // .debug()
        .expect('stdout', /hi, egg, 123456/)
        .expect('stdout', /ts env: true/)
        .expect('stdout', /should work/)
        .expect('code', 0)
        .end();
    });

    it('should cov app', () => {
      return coffee.fork(eggBin, [ 'cov', '--ts', '--espower=true' ], { cwd })
        .debug()
        .expect('stdout', /hi, egg, 123456/)
        .expect('stdout', /ts env: true/)
        .expect('stdout', os.platform() === 'win32' ? /Coverage summary/ : /Statements.*100%/)
        .expect('code', 0)
        .end();
    });

    it.skip('should cov app in cluster mod', () => {
      // skip on darwin
      // https://github.com/eggjs/egg-bin/runs/6735190362?check_suite_focus=true
      // [agent_worker] receive disconnect event on child_process fork mode, exiting with code:110
      if (process.platform === 'darwin') return;
      cwd = path.join(__dirname, './fixtures/example-ts-cluster');
      return coffee.fork(eggBin, [ 'cov', '--ts' ], { cwd })
        .debug()
        .expect('stdout', os.platform() === 'win32' ? /Coverage summary/ : /Statements/)
        .expect('code', 0)
        .end();
    });
  });

  describe('error stacks', () => {
    if (process.env.EGG_VERSION && process.env.EGG_VERSION === '1') {
      console.log('skip egg@1');
      return;
    }

    before(() => {
      cwd = path.join(__dirname, './fixtures/example-ts-error-stack');
    });

    it('should correct error stack line number in starting app', () => {
      mm(process.env, 'THROW_ERROR', 'true');
      return coffee.fork(eggBin, [ 'dev' ], { cwd })
        // .debug()
        .expect('stderr', /Error: throw error/)
        .expect('stderr', /at \w+ \(.+app\.ts:7:11\)/)
        .end();
    });

    it('should correct error stack line number in testing app', () => {
      if (process.platform === 'win32') return;

      return coffee.fork(eggBin, [ 'test' ], { cwd })
        .debug()
        .expect('stdout', /error/)
        .expect('stdout', /test[\/\\]{1}index\.test\.ts:8:11\)/)
        .expect('stdout', /test[\/\\]{1}index\.test\.ts:14:5\)/)
        .expect('stdout', /assert\(obj\.key === '222'\)/)
        .expect('stdout', /| {3}| {3}|/)
        .expect('stdout', /| {3}| {3}false/)
        .expect('stdout', /| {3}"111"/)
        .end();
    });

    it('should correct error stack line number in testing app with other tscompiler', () => {
      if (process.platform === 'win32') return;

      return coffee.fork(eggBin, [ 'test', '--tscompiler=esbuild-register' ], { cwd })
        .debug()
        .expect('stdout', /error/)
        .expect('stdout', /test[\/\\]{1}index\.test\.ts:8:11\)/)
        .expect('stdout', /test[\/\\]{1}index\.test\.ts:14:5\)/)
        .expect('stdout', /| {3}| {3}|/)
        .expect('stdout', /| {3}| {3}false/)
        .expect('stdout', /| {3}"111"/)
        .end();
    });

    it('should correct error stack line number in covering app', () => {
      if (process.platform === 'win32') return;

      return coffee.fork(eggBin, [ 'test' ], { cwd })
        // .debug()
        .expect('stdout', /error/)
        .expect('stdout', /test[\/\\]{1}index\.test\.ts:8:11\)/)
        .expect('stdout', /test[\/\\]{1}index\.test\.ts:14:5\)/)
        .expect('stdout', /assert\(obj\.key === '222'\)/)
        .expect('stdout', /| {3}| {3}|/)
        .expect('stdout', /| {3}| {3}false/)
        .expect('stdout', /| {3}"111"/)
        .end();
    });

    it('should correct error stack line number in mixed app', () => {
      if (process.platform === 'win32') return;

      const appDir = path.join(__dirname, './fixtures/example-ts-error-stack-mixed');
      const testFile = path.resolve(appDir, 'test/index.test.js');
      return coffee.fork(eggBin, [ 'test', testFile ], { cwd: appDir })
        // .debug()
        .expect('stdout', /error/)
        .expect('stdout', /test[\/\\]{1}index\.test\.js:8:11\)/)
        .expect('stdout', /test[\/\\]{1}index\.test\.js:14:5\)/)
        .expect('stdout', /assert\(obj\.key === '222'\)/)
        .expect('stdout', /| {3}| {3}|/)
        .expect('stdout', /| {3}| {3}false/)
        .expect('stdout', /| {3}"111"/)
        .end();
    });
  });

  describe('egg.typescript = true', () => {
    const tempNodeModules = path.join(__dirname, './fixtures/node_modules');
    const tempPackageJson = path.join(__dirname, './fixtures/package.json');
    afterEach(() => {
      fs.rmSync(tempNodeModules, { force: true, recursive: true });
      fs.rmSync(tempPackageJson, { force: true, recursive: true });
    });

    if (process.env.EGG_VERSION && process.env.EGG_VERSION === '1') {
      console.log('skip egg@1');
      return;
    }

    before(() => {
      cwd = path.join(__dirname, './fixtures/example-ts-pkg');
    });

    it('should start app', () => {
      return coffee.fork(eggBin, [ 'dev' ], { cwd })
        .debug()
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
      const cwd = path.join(__dirname, './fixtures/example-ts-simple');
      await coffee.fork(eggBin, [ 'dev', '--ts' ], { cwd })
        .debug()
        .expect('stdout', /started/)
        .expect('code', 0)
        .end();

      await coffee.fork(eggBin, [ 'dev', '--ts', '--tsc=esbuild-register' ], { cwd })
        // .debug()
        .expect('stdout', /started/)
        .expect('code', 0)
        .end();
    });

    it('should load custom ts compiler', async () => {
      const cwd = path.join(__dirname, './fixtures/example-ts-custom-compiler');

      // install custom ts-node
      fs.rmSync(path.join(cwd, 'node_modules'), { force: true, recursive: true });
      execSync('npx cnpm install', { cwd });

      // copy egg to node_modules
      await cpy(
        path.join(__dirname, './fixtures/example-ts-cluster/node_modules/egg'),
        path.join(cwd, './node_modules/egg')
      );

      const { stderr, code } = await coffee.fork(eggBin, [ 'dev', '--ts' ], { cwd, env: { DEBUG: 'egg-bin' } })
        // .debug()
        .end();
      assert(/ts-node@8\.10\.2/.test(stderr));
      assert.equal(code, 0);
    });

    it('should load custom ts compiler with tscompiler args', async () => {
      const cwd = path.join(__dirname, './fixtures/example-ts-custom-compiler-2');

      // install custom ts-node
      fs.rmSync(path.join(cwd, 'node_modules'), { force: true, recursive: true });
      execSync('npx cnpm install ts-node@8.10.2 --no-save', { cwd });

      // copy egg to node_modules
      await cpy(
        path.join(__dirname, './fixtures/example-ts-cluster/node_modules/egg'),
        path.join(cwd, './node_modules/egg')
      );

      const { stderr, code } = await coffee.fork(eggBin, [
        'dev', '--ts', '--tscompiler=ts-node/register',
      ], { cwd, env: { DEBUG: 'egg-bin' } })
        // .debug()
        .end();
      assert(/ts-node@8\.10\.2/.test(stderr));
      assert.equal(code, 0);
    });

    it('should not load custom ts compiler without tscompiler args', async () => {
      const cwd = path.join(__dirname, './fixtures/example-ts-custom-compiler-2');

      // install custom ts-node
      fs.rmSync(path.join(cwd, 'node_modules'), { force: true, recursive: true });
      execSync('npx cnpm install ts-node@8.10.2 --no-save', { cwd });

      // copy egg to node_modules
      await cpy(
        path.join(__dirname, './fixtures/example-ts-cluster/node_modules/egg'),
        path.join(cwd, './node_modules/egg')
      );

      const { stderr, code } = await coffee.fork(eggBin, [ 'dev', '--ts' ], { cwd, env: { DEBUG: 'egg-bin' } })
        .debug()
        .end();
      assert(!/ts-node@8\.10\.2/.test(stderr));
      assert(/ts-node/.test(stderr));
      assert.equal(code, 0);
    });

    it('should start app with other tscompiler without error', () => {
      return coffee.fork(eggBin, [ 'dev', '--ts', '--tscompiler=esbuild-register' ], {
        cwd: path.join(__dirname, './fixtures/example-ts'),
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
      return coffee.fork(eggBin, [ 'dev', '--ts' ], {
        cwd: path.join(__dirname, './fixtures/example-ts-pkg'),
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
        .debug()
        .expect('stdout', /hi, egg, 123456/)
        .expect('stdout', /ts env: true/)
        .expect('code', 0)
        .end();
    });

    it('should test with custom ts compiler without error', async () => {
      const cwd = path.join(__dirname, './fixtures/example-ts-custom-compiler');

      // install custom ts-node
      fs.rmSync(path.join(cwd, 'node_modules'), { force: true, recursive: true });
      execSync('npx cnpm install', { cwd });

      // copy egg to node_modules
      await cpy(
        path.join(__dirname, './fixtures/example-ts-cluster/node_modules/egg'),
        path.join(cwd, './node_modules/egg')
      );

      const { stdout, code } = await coffee.fork(eggBin, [ 'test', '--ts' ], { cwd, env: { DEBUG: 'egg-bin' } })
        // .debug()
        .end();
      assert(/ts-node@8\.10\.2/.test(stdout));
      assert(!/ts-node@7\.\d+\.\d+/.test(stdout));
      assert.equal(code, 0);
    });

    it('should cov app', () => {
      return coffee.fork(eggBin, [ 'cov', '--espower=true' ], { cwd })
        .debug()
        .expect('stdout', /hi, egg, 123456/)
        .expect('stdout', /ts env: true/)
        .expect('stdout', process.env.NYC_ROOT_ID ? /Coverage summary/ : /Statements.*100%/)
        .expect('code', 0)
        .end();
    });
  });

  describe('egg.declarations = true', () => {
    if (process.env.EGG_VERSION && process.env.EGG_VERSION === '1') {
      console.log('skip egg@1');
      return;
    }

    let pkgJson;
    before(() => {
      cwd = path.join(__dirname, './fixtures/example-ts-ets');
      pkgJson = JSON.parse(fs.readFileSync(path.resolve(cwd, './package.json')).toString());
    });

    beforeEach(() => fs.rmSync(path.resolve(cwd, './typings'), { force: true, recursive: true }));

    afterEach(() => {
      pkgJson.egg.declarations = false;
      fs.writeFileSync(path.resolve(cwd, './package.json'), JSON.stringify(pkgJson, null, 2));
    });

    it('should load egg-ts-helper with dts flag', () => {
      fs.mkdirSync(path.join(cwd, 'typings'));
      return coffee.fork(eggBin, [ 'dev', '--dts' ], { cwd })
        // .debug()
        .expect('stdout', /application log/)
        .expect('stdout', /"typescript":true/)
        .expect('stdout', /started/)
        .expect('code', 0)
        .end();
    });

    it('should load egg-ts-helper with egg.declarations = true', () => {
      fs.mkdirSync(path.join(cwd, 'typings'));
      pkgJson.egg.declarations = true;
      fs.writeFileSync(path.resolve(cwd, './package.json'), JSON.stringify(pkgJson, null, 2));
      return coffee.fork(eggBin, [ 'dev' ], { cwd })
        // .debug()
        .expect('stdout', /application log/)
        .expect('stdout', /"typescript":true/)
        .expect('stdout', /"declarations":true/)
        .expect('stdout', /started/)
        .expect('code', 0)
        .end();
    });

    it('should not load egg-ts-helper without flag and egg.declarations', () => {
      return coffee.fork(eggBin, [ 'dev' ], { cwd })
        // .debug()
        .expect('stdout', /"typescript":true/)
        .notExpect('stdout', /application log/)
        .notExpect('stdout', /"declarations":true/)
        .notExpect('stdout', /started/)
        .expect('code', 1)
        .end();
    });
  });
});

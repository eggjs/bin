import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs/promises';
import mm from 'mm';
import assertFile from 'assert-file';
import coffee from '../coffee';

describe('test/cmd/cov.test.ts', () => {
  const eggBin = path.join(__dirname, '../../src/bin/cli.ts');
  const fixtures = path.join(__dirname, '../fixtures');
  const cwd = path.join(fixtures, 'test-files');

  async function assertCoverage(baseDir: string) {
    assertFile(path.join(baseDir, 'coverage/coverage-final.json'));
    assertFile(path.join(baseDir, 'coverage/coverage-summary.json'));
    assertFile(path.join(baseDir, 'coverage/lcov-report/index.html'));
    assertFile(path.join(baseDir, 'coverage/lcov.info'));
  }

  afterEach(mm.restore);

  describe('egg-bin cov', () => {
    it('should success on js', async () => {
      await coffee.fork(eggBin, [ 'cov', '--ts=false' ], { cwd, env: { TESTS: 'test/**/*.test.js' } })
        // .debug()
        .expect('stdout', /should success/)
        .expect('stdout', /a\.test\.js/)
        .expect('stdout', /b[\/|\\]b\.test\.js/)
        .notExpect('stdout', /\ba\.js/)
        .expect('stdout', /Statements {3}:/)
        .expect('code', 0)
        .end();
      assertCoverage(cwd);
      const lcov = await fs.readFile(path.join(cwd, 'coverage/lcov.info'), 'utf8');
      assert.match(lcov, /ignore[\/|\\]a.js/);
    });

    it('should success on ts', async () => {
      const cwd = path.join(fixtures, 'example-ts');
      await coffee.fork(eggBin, [ 'cov' ], { cwd })
        // .debug()
        .expect('stdout', /should work/)
        .expect('stdout', /1 passing/)
        .expect('stdout', /Statements\s+: 100% \( \d+\/\d+ \)/)
        .expect('code', 0)
        .end();
      assertCoverage(cwd);
      const lcov = await fs.readFile(path.join(cwd, 'coverage/lcov.info'), 'utf8');
      assert.match(lcov, /SF:app\.ts/);
    });

    it('should success with COV_EXCLUDES', async () => {
      await coffee.fork(eggBin, [ 'cov', '--ts=false' ], {
        cwd,
        env: { TESTS: 'test/**/*.test.js', COV_EXCLUDES: 'ignore/*' },
      })
        // .debug()
        .expect('stdout', /should success/)
        .expect('stdout', /a\.test\.js/)
        .expect('stdout', /b[\/|\\]b\.test\.js/)
        .notExpect('stdout', /a.js/)
        .expect('stdout', /Statements {3}:/)
        .expect('code', 0)
        .end();
      assertCoverage(cwd);
      const lcov = await fs.readFile(path.join(cwd, 'coverage/lcov.info'), 'utf8');
      assert.doesNotMatch(lcov, /ignore[\/|\\]a.js/);
    });

    it('should success with -x to ignore one dirs', async () => {
      await coffee.fork(eggBin, [ 'cov', '-x', 'ignore/', 'test/**/*.test.js', '--ts=false' ], { cwd })
        // .debug()
        .expect('stdout', /should success/)
        .expect('stdout', /a\.test\.js/)
        .expect('stdout', /b[\/|\\]b\.test\.js/)
        .notExpect('stdout', /a.js/)
        .expect('stdout', /Statements {3}:/)
        .expect('code', 0)
        .end();
      assertCoverage(cwd);
      const lcov = await fs.readFile(path.join(cwd, 'coverage/lcov.info'), 'utf8');
      assert.doesNotMatch(lcov, /ignore[\/|\\]a.js/);
    });

    it('should success with -x to ignore multi dirs', async () => {
      await coffee.fork(eggBin, [
        'cov',
        '-x', 'ignore2/*',
        '-x', 'ignore/',
        '--ts=false',
        'test/**/*.test.js',
      ], { cwd })
        // .debug()
        .expect('stdout', /should success/)
        .expect('stdout', /a\.test\.js/)
        .expect('stdout', /b[\/|\\]b\.test\.js/)
        .notExpect('stdout', /a.js/)
        .expect('stdout', /Statements {3}:/)
        .expect('code', 0)
        .end();
      assertCoverage(cwd);
      const lcov = await fs.readFile(path.join(cwd, 'coverage/lcov.info'), 'utf8');
      assert.doesNotMatch(lcov, /ignore[\/|\\]a.js/);
    });

    it('should exit when not test files', () => {
      return coffee.fork(eggBin, [ 'cov', 'test/**/*.nth.js', '--ts=false' ], { cwd })
        // .debug()
        .expect('stdout', /No test files found/)
        .expect('code', 0)
        .end();
    });

    it('should fail when test fail', () => {
      return coffee.fork(eggBin, [ 'cov' ], { cwd, env: { TESTS: 'test/fail.js' } })
        // .debug()
        .expect('stdout', /1\) should fail/)
        .expect('stdout', /1 failing/)
        .expect('code', 1)
        .end();
    });

    it('should run cov when no test files', () => {
      const cwd = path.join(fixtures, 'prerequire');
      return coffee.fork(eggBin, [ 'cov', '--ts=false' ], { cwd, env: { TESTS: 'noexist.js' } })
        // .debug()
        .expect('code', 0)
        .end();
    });

    it('should set EGG_BIN_PREREQUIRE', async () => {
      const cwd = path.join(fixtures, 'prerequire');
      await coffee.fork(eggBin, [ 'cov', '--ts=false' ], { cwd, env: { TESTS: 'test/**/*.test.js' } })
        // .debug()
        .expect('stdout', /EGG_BIN_PREREQUIRE undefined/)
        .expect('stdout', /NODE_ENV test/)
        .expect('code', 0)
        .end();

      await coffee.fork(eggBin, [ 'cov', '--prerequire', '--ts=false' ], { cwd })
        // .debug()
        .expect('stdout', /EGG_BIN_PREREQUIRE true/)
        .expect('stdout', /NODE_ENV test/)
        .expect('code', 0)
        .end();
    });

    it('test parallel', () => {
      return coffee.fork(eggBin, [ 'cov', '--parallel', '--ts=false' ], {
        cwd: path.join(fixtures, 'test-demo-app'),
        env: { TESTS: 'test/**/*.test.js' },
      })
        // .debug()
        .expect('stdout', /should work/)
        .expect('stdout', /a\.test\.js/)
        .expect('code', 0)
        .end();
    });
  });
});

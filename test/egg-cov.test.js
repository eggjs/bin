'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const coffee = require('coffee');
const mm = require('mm');

describe('test/egg-cov.test.js', () => {
  const eggBin = require.resolve('../bin/egg-bin.js');
  const cwd = path.join(__dirname, 'fixtures/test-files');

  afterEach(mm.restore);

  it('should success', done => {
    mm(process.env, 'TESTS', 'test/**/*.test.js');
    coffee.fork(eggBin, [ 'cov' ], { cwd })
      .coverage(false)
      // .debug()
      .expect('stdout', /\/test\/fixtures\/test-files\/\.tmp true/)
      .expect('stdout', /✓ should success/)
      .expect('stdout', /a\.test\.js/)
      .expect('stdout', /b\/b\.test\.js/)
      .expect('stdout', /Statements {3}: 75% \( 3\/4 \)/)
      .expect('code', 0)
      .end((err, res) => {
        assert.ifError(err);
        assert.ok(!/a.js/.test(res.stdout));
        assert.ok(fs.existsSync(path.join(cwd, 'coverage/coverage-final.json')));
        assert.ok(fs.existsSync(path.join(cwd, 'coverage/lcov-report/index.html')));
        assert.ok(fs.existsSync(path.join(cwd, 'coverage/lcov.info')));
        assert.ok(!fs.existsSync(path.join(cwd, '.tmp')));
        done();
      });
  });

  it('should success with COV_EXCLUDES', done => {
    mm(process.env, 'TESTS', 'test/**/*.test.js');
    mm(process.env, 'COV_EXCLUDES', 'lib/*');
    coffee.fork(eggBin, [ 'cov' ], { cwd })
      .coverage(false)
      // .debug()
      .expect('stdout', /\/test\/fixtures\/test-files\/\.tmp true/)
      .expect('stdout', /✓ should success/)
      .expect('stdout', /a\.test\.js/)
      .expect('stdout', /b\/b\.test\.js/)
      .expect('stdout', /Statements {3}: Unknown% \( 0\/0 \)/)
      .expect('code', 0)
      .end((err, res) => {
        assert(!err);
        assert(!/a.js/.test(res.stdout));
        assert(fs.existsSync(path.join(cwd, 'coverage/coverage-final.json')));
        assert(fs.existsSync(path.join(cwd, 'coverage/lcov-report/index.html')));
        assert(fs.existsSync(path.join(cwd, 'coverage/lcov.info')));
        assert(!fs.existsSync(path.join(cwd, '.tmp')));
        done();
      });
  });

  it('should fail when test fail', done => {
    mm(process.env, 'TESTS', 'test/fail.js');
    coffee.fork(eggBin, [ 'cov' ], { cwd })
      .coverage(false)
      // .debug()
      .expect('stdout', /1\) should fail/)
      .expect('stdout', /1 failing/)
      .expect('code', 1)
      .end(done);
  });

  it('should fail when test fail with power-assert', done => {
    mm(process.env, 'TESTS', 'test/power-assert-fail.js');
    coffee.fork(eggBin, [ 'cov' ], { cwd })
      .coverage(false)
      // .debug()
      .expect('stdout', /1\) should fail/)
      .expect('stdout', /1 failing/)
      .expect('stdout', /assert\(1 === 2\)/)
      .expect('code', 1)
      .end(done);
  });

  it('should warn when require intelli-espower-loader', done => {
    mm(process.env, 'TESTS', 'test/power-assert-fail.js');
    coffee.fork(eggBin, [ 'cov', '-r', 'intelli-espower-loader' ], { cwd })
      .coverage(false)
      // .debug()
      .expect('stderr', /manually require `intelli-espower-loader`/)
      .expect('stdout', /1\) should fail/)
      .expect('stdout', /1 failing/)
      .expect('stdout', /assert\(1 === 2\)/)
      .expect('code', 1)
      .end(done);
  });

  if (process.platform === 'win32') {
    it('should exec test instead of cov in win32', done => {
      mm(process, 'platform', 'win32');
      mm(process.env, 'TESTS', 'test/**/*.test.js');
      coffee.fork(eggBin, [ 'cov' ], { cwd })
        // .debug()
        .expect('stdout', /✓ should success/)
        .expect('stdout', /a\.test\.js/)
        .expect('stdout', /b\/b\.test\.js/)
        .notExpect('stdout', /Coverage summary/)
        .expect('code', 0)
        .end((err, res) => {
          assert.ifError(err);
          assert(!/a\.js/.test(res.stdout));
          done();
        });
    });
  }
});

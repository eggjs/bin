import coffee from './coffee.js';
import { getFixtures } from './helper.js';

describe.skip('test/my-egg-bin.test.ts', () => {
  const eggBin = getFixtures('my-egg-bin/bin/my-egg-bin.ts');
  const cwd = getFixtures('test-files');

  it('should my-egg-bin test success', () => {
    return coffee.fork(eggBin, [ 'test' ], { cwd, env: { TESTS: 'test/**/*.test.js' } })
      .debug()
      .expect('stdout', /should success/)
      .expect('stdout', /a.test.js/)
      .expect('stdout', /b\/b.test.js/)
      .notExpect('stdout', /a.js/)
      .expect('code', 0)
      .end();
  });

  it('should my-egg-bin nsp success', async () => {
    await coffee.fork(eggBin, [ 'nsp', '-h' ], { cwd })
      // .debug()
      .expect('stdout', /-baseDir, --base string/)
      .expect('code', 0)
      .end();

    await coffee.fork(eggBin, [ 'nsp' ], { cwd })
      // .debug()
      .expect('stdout', /run nsp check at baseDir: .+test\-files, with/)
      .expect('code', 0)
      .end();
  });

  it('should show help', async () => {
    await coffee.fork(eggBin, [ '--help' ], { cwd })
      // .debug()
      .expect('stdout', /Usage: my-egg-bin/)
      .expect('stdout', /Available Commands/)
      .expect('stdout', /test \[files\.\.\.]\s+Run the test/)
      .expect('stdout', /-ts, --typescript\s+whether enable typescript support/)
      .expect('stdout', /nsp\s+nsp check/)
      .expect('code', 0)
      .end();

    await coffee.fork(eggBin, [ 'dev', '-h' ], { cwd })
      // .debug()
      .expect('stdout', /Usage: my-egg-bin/)
      .expect('stdout', /dev\s+Run the development server with my-egg-bin/)
      .expect('stdout', /-p, --port number/)
      .expect('stdout', /-ts, --typescript\s+whether enable typescript support/)
      .expect('code', 0)
      .end();
  });

  it('should my-egg-bin dev success', () => {
    const baseDir = getFixtures('custom-framework-app');
    return coffee.fork(eggBin, [ 'dev' ], { cwd: baseDir })
      // .debug()
      .expect('stdout', /yadan start/)
      .expect('stdout', /this is my-egg-bin dev/)
      .expect('code', 0)
      .end();
  });

  it('should show version 2.3.4', () => {
    return coffee.fork(eggBin, [ '--version' ], { cwd })
      // .debug()
      .expect('stdout', '2.3.4\n')
      .expect('code', 0)
      .end();
  });
});

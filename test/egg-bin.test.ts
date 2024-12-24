import path from 'node:path';
import coffee from './coffee.js';

describe('test/egg-bin.test.ts', () => {
  const eggBin = path.join(__dirname, '../src/bin/cli.ts');
  const fixtures = path.join(__dirname, 'fixtures');
  const cwd = path.join(fixtures, 'test-files');

  describe('global options', () => {
    it('should show version', () => {
      return coffee.fork(eggBin, [ '--version' ], { cwd })
        // .debug()
        .expect('stdout', /\d+\.\d+\.\d+/)
        .expect('code', 0)
        .end();
    });

    it('should main redirect to help', () => {
      return coffee.fork(eggBin, [], { cwd })
        // .debug()
        .expect('stdout', /Usage: egg-bin/)
        .expect('stdout', /Available Commands/)
        .expect('stdout', /test \[files\.\.\.]\s+Run the test/)
        .expect('stdout', /-ts, --typescript\s+whether enable typescript support/)
        .expect('code', 0)
        .end();
    });

    it('should show help', () => {
      return coffee.fork(eggBin, [ '--help' ], { cwd })
        // .debug()
        .expect('stdout', /Usage: egg-bin/)
        .expect('stdout', /Available Commands/)
        .expect('stdout', /test \[files\.\.\.]\s+Run the test/)
        .expect('stdout', /-ts, --typescript\s+whether enable typescript support/)
        .expect('code', 0)
        .end();
    });

    it('should show egg-bin test help', () => {
      return coffee.fork(eggBin, [ 'test', '-h', '--base', cwd ])
        // .debug()
        .expect('stdout', /Usage: egg-bin test \[files\.\.\.]/)
        .expect('stdout', /-ts, --typescript\s+whether enable typescript support/)
        .expect('code', 0)
        .end();
    });

    it('should show help when command not exists', () => {
      return coffee.fork(eggBin, [ 'not-exists' ], { cwd })
        // .debug()
        .expect('stderr', /Command is not found: 'egg-bin not-exists', try 'egg-bin --help' for more information/)
        .expect('code', 1)
        .end();
    });
  });
});

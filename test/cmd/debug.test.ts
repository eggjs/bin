import path from 'node:path';
import coffee from '../coffee.js';
import { getFixtures, getRootDirname } from '../helper.js';

describe('test/cmd/debug.test.ts', () => {
  const eggBin = path.join(getRootDirname(), 'bin/run.js');
  const cwd = getFixtures('demo-app');

  it('should startCluster success', () => {
    return coffee.fork(eggBin, [ 'debug' ], { cwd })
      // .debug()
      .expect('stdout', /"workers":1/)
      .expect('stdout', /"baseDir":".*?demo-app"/)
      .expect('stdout', /"framework":".*?aliyun-egg"/)
      .expect('stdout', /NODE_ENV: development/)
      .expect('stderr', /Debugger listening/)
      .expect('code', 0)
      .end();
  });
});

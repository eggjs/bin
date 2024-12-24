import path from 'node:path';
import net from 'node:net';
import detect from 'detect-port';
import { mm } from '@eggjs/mock';
import coffee from '../coffee';

const version = Number(process.version.substring(1, 3));

describe('test/cmd/dev.test.ts', () => {
  const eggBin = path.join(__dirname, '../../src/bin/cli.ts');
  const fixtures = path.join(__dirname, '../fixtures');
  const cwd = path.join(fixtures, 'demo-app');

  it('should startCluster success', () => {
    return coffee.fork(eggBin, [ 'dev' ], {
      cwd,
      // env: { NODE_DEBUG: 'egg-bin*' },
    })
      // .debug()
      .expect('stdout', /"workers":1/)
      .expect('stdout', /"baseDir":".*?demo-app"/)
      .expect('stdout', /"framework":".*?aliyun-egg"/)
      .expect('stdout', /NODE_ENV: development/)
      .expect('code', 0)
      .end();
  });

  it('should dev start with custom NODE_ENV', () => {
    return coffee.fork(eggBin, [ 'dev' ], { cwd, env: { NODE_ENV: 'prod' } })
      // .debug()
      .expect('stdout', /"workers":1/)
      .expect('stdout', /"baseDir":".*?demo-app"/)
      .expect('stdout', /"framework":".*?aliyun-egg"/)
      .expect('stdout', /NODE_ENV: prod/)
      .expect('code', 0)
      .end();
  });

  it('should dev start work with declarations = true', () => {
    const cwd = path.join(fixtures, 'example-declarations');
    return coffee.fork(eggBin, [ 'dev' ], { cwd })
      .debug()
      .expect('stdout', /"workers":1/)
      .expect('stdout', /"baseDir":".*?example-declarations"/)
      .expect('stdout', /"framework":".*?egg"/)
      .expect('stdout', /\[egg-ts-helper\] create typings/)
      .expect('code', 0)
      .end();
  });

  it('should startCluster with --port', () => {
    return coffee.fork(eggBin, [ 'dev', '--port', '6001' ], { cwd })
      // .debug()
      .expect('stdout', /"workers":1/)
      .expect('stdout', /"port":6001/)
      .expect('stdout', /"baseDir":".*?demo-app"/)
      .expect('stdout', /"framework":".*?aliyun-egg"/)
      .expect('code', 0)
      .end();
  });

  it('should startCluster with --sticky', () => {
    return coffee.fork(eggBin, [ 'dev', '--port', '6001', '--sticky' ], { cwd })
      // .debug()
      .expect('stdout', /"workers":1/)
      .expect('stdout', /"port":6001/)
      .expect('stdout', /"sticky":true/)
      .expect('stdout', /"baseDir":".*?demo-app"/)
      .expect('stdout', /"framework":".*?aliyun-egg"/)
      .expect('code', 0)
      .end();
  });

  it('should startCluster with -p', () => {
    return coffee.fork(eggBin, [ 'dev', '-p', '6001' ], { cwd })
      // .debug()
      .expect('stdout', /"workers":1/)
      .expect('stdout', /"port":6001/)
      .expect('stdout', /"baseDir":".*?demo-app"/)
      .expect('stdout', /"framework":".*?aliyun-egg"/)
      .expect('code', 0)
      .end();
  });

  it('should startCluster with --cluster=2', () => {
    return coffee.fork(eggBin, [ 'dev', '--cluster=2' ], { cwd })
      // .debug()
      .expect('stdout', /"workers":2/)
      .expect('stdout', /"baseDir":".*?demo-app"/)
      .expect('stdout', /"framework":".*?aliyun-egg"/)
      .notExpect('stdout', /"cluster"/)
      .expect('code', 0)
      .end();
  });

  it('should startCluster with --workers=2', () => {
    return coffee.fork(eggBin, [ 'dev', '--workers=2' ], { cwd })
      // .debug()
      .expect('stdout', /"workers":2/)
      .expect('stdout', /"baseDir":".*?demo-app"/)
      .expect('stdout', /"framework":".*?aliyun-egg"/)
      .notExpect('stdout', /"cluster"/)
      .expect('code', 0)
      .end();
  });

  it('should startCluster with --baseDir=root', () => {
    return coffee.fork(eggBin, [ 'dev', `--baseDir=${cwd}` ])
      // .debug()
      .expect('stdout', /"workers":1/)
      .expect('stdout', /"baseDir":".*?demo-app"/)
      .expect('stdout', /"framework":".*?aliyun-egg"/)
      .expect('code', 0)
      .end();
  });

  it('should startCluster with custom yadan framework', () => {
    const baseDir = path.join(fixtures, 'custom-framework-app');
    return coffee.fork(eggBin, [ 'dev' ], { cwd: baseDir })
      // .debug()
      .expect('stdout', /yadan start:/)
      .expect('stdout', /"workers":1/)
      .expect('stdout', /"baseDir":".*?custom-framework-app"/)
      .expect('stdout', /"framework":".*?yadan"/)
      .expect('code', 0)
      .end();
  });

  it('should startCluster with execArgv --inspect', () => {
    return coffee.fork(eggBin, [ 'dev', '--inspect' ], { cwd })
      // .debug()
      .expect('stderr', /Debugger listening on ws:\/\/127.0.0.1:\d+/)
      .expect('code', 0)
      .end();
  });

  it('should support --require', () => {
    const script = path.join(fixtures, 'require-script');
    return coffee.fork(eggBin, [ 'dev', '--require', script ], { cwd })
      // .debug()
      .expect('stdout', /hey, you require me by --require/)
      .expect('code', 0)
      .end();
  });

  it('should support egg.require', () => {
    return coffee.fork(eggBin, [ 'dev' ], {
      cwd: path.join(fixtures, 'egg-require'),
    })
      // .debug()
      .expect('stdout', /hey, you require me by --require/)
      .expect('code', 0)
      .end();
  });

  describe('auto detect available port', () => {
    let server;
    let serverPort;
    before(async () => {
      serverPort = await detect(7001);
      server = net.createServer();
      await new Promise(resolve => {
        server.listen(serverPort, resolve);
      });
    });

    after(() => server.close());

    it('should auto detect available port', done => {
      coffee.fork(eggBin, [ 'dev' ], {
        cwd,
        env: { EGG_BIN_DEFAULT_PORT: serverPort },
      })
        // .debug()
        .expect('stderr', /\[egg-bin] server port \d+ is in use, now using port \d+/)
        .expect('code', 0)
        .end(done);
    });
  });

  describe('obtain the port from config.*.js', () => {
    const cwd = path.join(fixtures, 'example-port');
    it('should obtain the port from config.default.js', () => {
      coffee.fork(eggBin, [ 'dev' ], {
        cwd,
      })
        .expect('stdout', /"port":6001/)
        .expect('code', 0)
        .end();
    });
  });

  it('should support egg.revert', () => {
    if (version < 18 || version > 20) return;
    mm(process.env, 'NODE_ENV', 'development');
    return coffee.fork(eggBin, [ 'dev' ], {
      cwd: path.join(__dirname, '../fixtures/egg-revert'),
    })
      // .debug()
      .expect('stdout', /SECURITY WARNING: Reverting CVE-2023-46809: Marvin attack on PKCS#1 padding/)
      .expect('code', 0)
      .end();
  });
});

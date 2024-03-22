const path = require('node:path');
const coffee = require('coffee');
const mm = require('mm');
const fs = require('node:fs/promises');
const assert = require('assert');

describe('test/lib/cmd/dal.test.js', () => {
  const eggBin = require.resolve('../../../bin/egg-bin.js');
  const cwd = path.join(__dirname, '../../fixtures/dal');

  afterEach(mm.restore);

  describe('egg-bin dal gen', () => {
    after(async () => {
      await fs.rm(path.join(cwd, 'app/modules/dal/dal'), {
        recursive: true,
      });
    });

    it('egg-bin dal gen should work', async () => {
      await coffee.fork(eggBin, [ 'dal', 'gen' ], { cwd })
        .debug()
        .expect('code', 0)
        .end();

      for (const file of [
        'app/modules/dal/dal/dao/BarDAO.ts',
        'app/modules/dal/dal/dao/FooDAO.ts',
        'app/modules/dal/dal/dao/base/BaseBarDAO.ts',
        'app/modules/dal/dal/dao/base/BaseFooDAO.ts',
        'app/modules/dal/dal/extension/BarExtension.ts',
        'app/modules/dal/dal/extension/FooExtension.ts',
        'app/modules/dal/dal/structure/Bar.json',
        'app/modules/dal/dal/structure/Bar.sql',
        'app/modules/dal/dal/structure/Foo.json',
        'app/modules/dal/dal/structure/Foo.sql',
      ]) {
        assert.ok(fs.stat(path.join(cwd, file)));
      }
    });
  });
});

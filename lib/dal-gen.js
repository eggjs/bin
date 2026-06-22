const assert = require('node:assert');
const { TableModel, TableInfoUtil } = require('@eggjs/tegg/dal');
const { CodeGenerator } = require('@eggjs/dal-runtime');
const { LoaderFactory } = require('@eggjs/tegg/helper');

const moduleDir = process.argv[2];
assert(moduleDir, 'miss module dir');

const moduleName = process.argv[3];
assert(moduleName, 'miss module name');

const teggPkgName = process.argv[4];

const teggDalPkgName = process.argv[5];

(async () => {
  try {
    console.log('[egg-bin] start dal gen for %s', moduleName);
    const generator = new CodeGenerator({
      moduleDir,
      moduleName,
      teggPkg: teggPkgName,
      dalPkg: teggDalPkgName,
    });
    const loader = LoaderFactory.createLoader(moduleDir, 'MODULE');
    const clazzList = await loader.load();
    for (const clazz of clazzList) {
      if (TableInfoUtil.getIsTable(clazz)) {
        const tableModel = TableModel.build(clazz);
        console.log('[egg-bin] generate code for %s', clazz.name);
        await generator.generate(tableModel);
      }
    }
    console.log('[egg-bin] dal generate done');
    process.exit(0);
  } catch (e) {
    e.message = `[egg-bin] generate dal code ${moduleDir} failed: ` + e.message;
    console.error(e);
    process.exit(1);
  }
})();


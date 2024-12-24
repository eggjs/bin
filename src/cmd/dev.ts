import { debuglog } from 'node:util';
import { DefineCommand, Option } from '@artus-cli/artus-cli';
import utils from '@eggjs/utils';
import detect from 'detect-port';
import { BaseCommand } from './base.js';
import { getSourceFilename } from '../utils.js';

const debug = debuglog('egg-bin:dev');

@DefineCommand({
  command: 'dev',
  description: 'Start server at local dev mode',
  alias: [ 'd' ],
})
export class DevCommand extends BaseCommand {
  @Option({
    description: 'listening port, default to 7001',
    alias: 'p',
  })
  port: number;

  @Option({
    description: 'numbers of app workers, default to 1 at local mode',
    alias: [ 'c', 'cluster' ],
    default: 1,
  })
  workers: number;

  @Option({
    description: 'specify framework that can be absolute path or npm package, default is egg',
  })
  framework: string;

  @Option({
    description: 'start a sticky cluster server, default to false',
    type: 'boolean',
    default: false,
  })
  sticky: boolean;

  async run() {
    debug('run dev: %o', this.ctx.args);
    this.ctx.env.NODE_ENV = this.ctx.env.NODE_ENV ?? 'development';
    this.ctx.env.EGG_MASTER_CLOSE_TIMEOUT = '1000';
    const serverBin = getSourceFilename('../scripts/start-cluster.mjs');
    const eggStartOptions = await this.formatEggStartOptions();
    const args = [ JSON.stringify(eggStartOptions) ];
    const requires = await this.formatRequires();
    const execArgv: string[] = [];
    for (const r of requires) {
      execArgv.push('--require');
      execArgv.push(r);
    }
    await this.forkNode(serverBin, args, { execArgv });
  }

  protected async formatEggStartOptions() {
    this.framework = utils.getFrameworkPath({
      framework: this.framework,
      baseDir: this.base,
    });

    if (!this.port) {
      let configuredPort: number | undefined;
      try {
        const configuration = await utils.getConfig({
          framework: this.framework,
          baseDir: this.base,
          env: 'local',
        });
        configuredPort = configuration?.cluster?.listen?.port;
      } catch (err) {
        /** skip when failing to read the configuration */
        debug('getConfig error: %s, framework: %o, baseDir: %o, env: local',
          err, this.framework, this.base);
      }
      if (configuredPort) {
        this.port = configuredPort;
        debug(`use port ${this.port} from configuration file`);
      } else {
        const defaultPort = process.env.EGG_BIN_DEFAULT_PORT ?? 7001;
        debug('detect available port');
        this.port = await detect(defaultPort);
        if (this.port !== defaultPort) {
          console.warn('[egg-bin] server port %s is in use, now using port %o',
            defaultPort, this.port);
        }
        debug(`use available port ${this.port}`);
      }
    }

    return {
      baseDir: this.base,
      workers: this.workers,
      port: this.port,
      framework: this.framework,
      typescript: this.ctx.args.typescript,
      tscompiler: this.ctx.args.tscompiler,
      sticky: this.sticky,
    };
  }
}

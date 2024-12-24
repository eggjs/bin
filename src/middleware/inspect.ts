import { debuglog } from 'node:util';
import {
  Inject, ApplicationLifecycle, LifecycleHook, LifecycleHookUnit,
  Program, CommandContext,
} from '@artus-cli/artus-cli';
import { addNodeOptionsToEnv } from '../utils.js';

const debug = debuglog('@eggjs/bin/middleware/inspect');

@LifecycleHookUnit()
export default class implements ApplicationLifecycle {
  @Inject()
  private readonly program: Program;

  @LifecycleHook()
  async configDidLoad() {
    // add global options
    // https://nodejs.org/dist/latest-v18.x/docs/api/cli.html#--inspect-brkhostport
    this.program.option({
      'inspect-brk': {
        description: 'Activate inspector and break at start of user script',
        type: 'boolean',
      },
      inspect: {
        description: 'Activate inspector',
        type: 'boolean',
      },
    });

    this.program.use(async (ctx: CommandContext, next) => {
      debug('before next');
      let hasInspectOption = false;
      if (ctx.args.inspect === true) {
        addNodeOptionsToEnv('--inspect', ctx.env);
        hasInspectOption = true;
      }
      if (ctx.args['inspect-brk'] === true) {
        addNodeOptionsToEnv('--inspect-brk', ctx.env);
        hasInspectOption = true;
      }
      if (hasInspectOption) {
        ctx.args.timeout = false;
        debug('set timeout = false when inspect enable, set env.NODE_OPTIONS=%o', ctx.env.NODE_OPTIONS);
      } else if (process.env.JB_DEBUG_FILE) {
        // others like WebStorm 2019 will pass NODE_OPTIONS, and egg-bin itself will be debug, so could detect `process.env.JB_DEBUG_FILE`.
        ctx.args.timeout = false;
        debug('set timeout = false when process.env.JB_DEBUG_FILE=%o', process.env.JB_DEBUG_FILE);
      }
      debug('enter next');
      await next();
      debug('after next');
    });
  }
}

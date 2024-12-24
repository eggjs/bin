import { debuglog } from 'node:util';
import {
  Inject, ApplicationLifecycle, LifecycleHook, LifecycleHookUnit, Program,
  ArtusCliError,
} from '@artus-cli/artus-cli';

const debug = debuglog('@eggjs/bin/middleware/handle_error');

@LifecycleHookUnit()
export default class implements ApplicationLifecycle {
  @Inject()
  private readonly program: Program;

  @LifecycleHook()
  async configDidLoad() {
    this.program.use(async (_, next) => {
      debug('enter next');
      try {
        await next();
        debug('after next');
      } catch (err: any) {
        debug('next error: %o', err);
        // let artus cli to handle it
        if (err instanceof ArtusCliError) throw err;
        console.error(err);
        process.exit(typeof err.code === 'number' ? err.code : 1);
      }
    });
  }
}

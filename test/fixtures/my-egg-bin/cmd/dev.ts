import { DefineCommand } from '@artus-cli/artus-cli';
import { DevCommand as BaseDevCommand } from '../../../../src/index.js';

@DefineCommand({
  command: 'dev',
  description: 'Run the development server with my-egg-bin',
})
export class DevCommand extends BaseDevCommand {
  async run() {
    super.run();
    console.info('this is my-egg-bin dev, baseDir: %s', this.base);
  }
}

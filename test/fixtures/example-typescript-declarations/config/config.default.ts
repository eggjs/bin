import { EggAppConfig, PowerPartial } from 'egg';

export default (): PowerPartial<EggAppConfig> => {
  return {
    keys: 'example-typescript-declarations',
  };
};

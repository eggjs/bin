import fs from 'node:fs/promises';
import path from 'node:path';

export function addNodeOptionsToEnv(options: string, env: Record<string, any>) {
  if (env.NODE_OPTIONS) {
    if (!env.NODE_OPTIONS.includes(options)) {
      env.NODE_OPTIONS = `${env.NODE_OPTIONS} ${options}`;
    }
  } else {
    env.NODE_OPTIONS = options;
  }
}

export async function readPackageJSON(baseDir: string) {
  const pkgFile = path.join(baseDir, 'package.json');
  try {
    const pkgJSON = await fs.readFile(pkgFile, 'utf8');
    return JSON.parse(pkgJSON);
  } catch {
    return {};
  }
}

export async function hasTsConfig(baseDir: string) {
  const pkgFile = path.join(baseDir, 'tsconfig.json');
  try {
    await fs.access(pkgFile);
    return true;
  } catch {
    return false;
  }
}

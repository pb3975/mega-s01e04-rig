import { readFileSync } from 'node:fs';

export const HOST = '127.0.0.1';

export type RigConfig = {
  adapter: string;
  installed: string;
  beatEverySeconds: number;
  runsDir: string;
};

export function loadConfig(path = 'rig.json'): RigConfig {
  return JSON.parse(readFileSync(path, 'utf8')) as RigConfig;
}

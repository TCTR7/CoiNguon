import { readFile } from 'node:fs/promises';
const target = JSON.parse(await readFile('dist/build-target.json', 'utf8'));
if (target.mode !== 'local' || target.projectId !== 'demo-coinguon')
  throw new Error('PWA tests require an Emulator build. Run npm run build:local first.');

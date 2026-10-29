import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function walk(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = dir + '/' + entry.name;
    if (entry.isDirectory()) result.push(...(await walk(path)));
    else if (!path.endsWith('/sw.js')) result.push(path);
  }
  return result;
}
const paths = (await walk('dist')).sort();
const digest = createHash('sha256');
for (const path of paths) digest.update(await readFile(path));
const template = await readFile('scripts/service-worker.js', 'utf8');
await writeFile(
  'dist/sw.js',
  template
    .replace('__CACHE_VERSION__', digest.digest('hex').slice(0, 16))
    .replace('__ASSET_LIST__', JSON.stringify(paths.map((p) => '/' + p.slice(5)))),
);
console.log('PWA app shell: ' + paths.length + ' static files; no API or private data.');

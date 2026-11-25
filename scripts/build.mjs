import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve('dist');
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
};
const entries = {};
async function collect(folder) {
  for (const entry of await fs.readdir(path.join(root, folder), { withFileTypes: true })) {
    if (entry.name === 'server' && !folder) continue;
    const relative = path.join(folder, entry.name);
    if (entry.isDirectory()) await collect(relative);
    else {
      const type = types[path.extname(entry.name)];
      if (!type) throw new Error('No media type for ' + relative);
      entries['/' + relative] = [type, (await fs.readFile(path.join(root, relative))).toString('base64')];
    }
  }
}
await collect('');
await build({
  entryPoints: ['server/worker.js'],
  bundle: true,
  outfile: 'dist/server/index.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2023',
  plugins: [{
    name: 'portal-assets',
    setup(plugin) {
      plugin.onResolve({ filter: /^portal-assets$/ }, () => ({ path: 'portal-assets', namespace: 'site' }));
      plugin.onLoad({ filter: /.*/, namespace: 'site' }, () => ({
        contents: 'export default ' + JSON.stringify(entries),
        loader: 'js',
      }));
    },
  }],
});
await fs.writeFile('dist/server/wrangler.json', JSON.stringify({
  main: 'index.js',
  compatibility_date: '2025-04-01',
  d1_databases: [{ binding: 'DB', database_name: 'narra-affiliate', database_id: '00000000-0000-0000-0000-000000000000', migrations_dir: '../../drizzle' }],
}, null, 2) + '\n');

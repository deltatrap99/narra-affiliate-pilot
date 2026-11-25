import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { loadPortalAssets } from './portal-assets.mjs';

const entries = await loadPortalAssets();
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

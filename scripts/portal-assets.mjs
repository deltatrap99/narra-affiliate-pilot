import fs from 'node:fs/promises';
import path from 'node:path';

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
};

export async function loadPortalAssets(root = path.resolve('dist')) {
  const assets = {};
  async function collect(folder) {
    for (const entry of await fs.readdir(path.join(root, folder), { withFileTypes: true })) {
      if (entry.name === 'server' && !folder) continue;
      const relative = path.join(folder, entry.name);
      if (entry.isDirectory()) await collect(relative);
      else {
        const type = types[path.extname(entry.name)];
        if (!type) throw new Error('No media type for ' + relative);
        assets['/' + relative.split(path.sep).join('/')] = [type, (await fs.readFile(path.join(root, relative))).toString('base64')];
      }
    }
  }
  await collect('');
  return assets;
}

import fs from 'node:fs/promises';
import { loadPortalAssets } from './portal-assets.mjs';

const assets = await loadPortalAssets();
await fs.mkdir('.vercel-build/static', { recursive: true });
await fs.writeFile('.vercel-build/assets.mjs', 'export default ' + JSON.stringify(assets) + ';\n');
await fs.writeFile('.vercel-build/static/404.html',
  '<!doctype html><html lang="vi"><meta charset="utf-8"><title>Narra Affiliate</title><h1>Không tìm thấy trang</h1></html>\n');

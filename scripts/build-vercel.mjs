import fs from 'node:fs/promises';
import { loadPortalAssets } from './portal-assets.mjs';

const assets = await loadPortalAssets();
await fs.mkdir('.vercel-build/static', { recursive: true });
await fs.writeFile('.vercel-build/assets.mjs', 'export default ' + JSON.stringify(assets) + ';\n');

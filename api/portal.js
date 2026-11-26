import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import assets from '../.vercel-build/assets.mjs';
import { sitesOrigin, vercelConnection, vercelCallback, relayHeader, hostSessionSeconds } from '../server/hosting.js';

const accessCookie = '__Host-narra_sites_access';
const flowCookie = '__Host-narra_sites_flow';
const portalCookie = '__Host-narra_portal';
const visitorCookie = '__Host-narra_visitor';
const browserPages = new Set(['/', '/portal', '/r']);
const handoffSeconds = 600;
const authError = 'Bạn cần xác thực quyền truy cập Narra.';
const relayError = 'Chưa thể kết nối cổng đối tác. Vui lòng thử lại.';

function cookieFrom(req, name) {
  const prefix = name + '=';
  return req.headers.cookie?.split(';').map(value => value.trim())
    .find(value => value.startsWith(prefix))?.slice(prefix.length) ?? '';
}

function responseCookie(name, value, seconds) {
  return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
}

function signature(value, key) {
  return createHmac('sha256', key).update(value).digest();
}

function signedValue(data, lifetime, key) {
  const data64 = Buffer.from(JSON.stringify({ ...data, expires: Date.now() + lifetime * 1000 })).toString('base64url');
  return data64 + '.' + signature(data64, key).toString('base64url');
}

function readSigned(value, key) {
  if (value.length > 3500 || !/^[a-z\d_-]+\.[a-z\d_-]{43}$/i.test(value)) return null;
  const [data, mac] = value.split('.');
  if (!timingSafeEqual(signature(data, key), Buffer.from(mac, 'base64url'))) return null;
  const decoded = JSON.parse(Buffer.from(data, 'base64url').toString());
  return decoded.expires > Date.now() ? decoded : null;
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.statusCode = status;
  res.setHeader('content-type', type);
  res.end(body);
}

function json(res, status, data) {
  send(res, status, JSON.stringify(data), 'application/json; charset=utf-8');
}

function redirect(res, target, status = 303) {
  res.statusCode = status;
  res.setHeader('location', target);
  res.end();
}

const escapeHtml = value => value.replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[char]);

function connectionPage(res, title, copy, href, script = '', status = 200) {
  const nonce = randomBytes(18).toString('base64url');
  res.setHeader('content-security-policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'`);
  res.setHeader('referrer-policy', 'no-referrer');
  send(res, status, `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f3fb;color:#261b37;font:1rem/1.55 system-ui,sans-serif}main{box-sizing:border-box;width:min(92vw,31rem);padding:2.3rem;border:1px solid #e7def3;border-radius:1.25rem;background:white}h1{font-size:1.55rem}p{color:#5f536f}a{display:inline-block;padding:.7rem 1rem;border-radius:.6rem;background:#5f36ad;color:white;font-weight:600;text-decoration:none}</style>
    <main><h1>${title}</h1><p>${copy}</p><a id="continue" rel="noreferrer" href="${escapeHtml(href)}">Tiếp tục</a></main>
    ${script ? `<script nonce="${nonce}">${script}</script>` : ''}</html>`, 'text/html; charset=utf-8');
}

function startAccess(res, url, key) {
  const proof = randomBytes(32).toString('hex');
  const target = new URL(vercelConnection + '/authorize', sitesOrigin);
  target.searchParams.set('challenge', createHash('sha256').update(proof).digest('hex'));
  res.setHeader('set-cookie', responseCookie(flowCookie, signedValue({
    proof, path: url.pathname + (url.search.length <= 512 ? url.search : ''),
  }, handoffSeconds, key), handoffSeconds));
  connectionPage(res, 'Truy cập Narra Affiliate', 'Đang kiểm tra quyền truy cập của bạn.',
    target.href, `try {
      sessionStorage.setItem('narra-vercel-fragment', location.hash.slice(0, 1024));
    } catch {}
    location.replace(document.getElementById('continue').href);`);
}

async function sitesRequest(config, path, options) {
  // The Sites service credential is scoped to this exact origin and never follows redirects.
  const url = sitesOrigin + vercelConnection + path;
  return fetch(url, {
    ...options, redirect: 'manual', signal: AbortSignal.timeout(15_000),
    headers: { ...options.headers, 'OAI-Sites-Authorization': 'Bearer ' + config.siteToken },
  });
}

async function finishAccess(req, res, url, config) {
  const flow = readSigned(cookieFrom(req, flowCookie), config.key);
  const ticket = url.searchParams.get('ticket');
  if (!flow?.proof || !ticket || ticket.length > 2048) {
    return connectionPage(res, 'Mở lại Narra Affiliate', 'Phiên kết nối đã hết hạn. Hãy mở lại cổng đối tác.', '/', '', 401);
  }
  const upstream = await sitesRequest(config, '/exchange', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket, proof: flow.proof }),
  });
  const result = upstream.ok ? await upstream.json() : null;
  const seconds = Math.min(hostSessionSeconds, (result?.expires ?? 0) - Math.floor(Date.now() / 1000));
  if (typeof result?.session !== 'string' || result.session.length > 2048 || !Number.isInteger(seconds) || seconds <= 0) {
    return connectionPage(res, 'Mở lại Narra Affiliate', 'Chưa thể xác thực phiên truy cập. Vui lòng thử lại.', '/', '', 401);
  }
  const returnTo = new URL(flow.path, config.origin);
  const target = returnTo.origin === config.origin && browserPages.has(returnTo.pathname) ? returnTo.href : config.origin;
  res.setHeader('set-cookie', [
    responseCookie(accessCookie, signedValue({ session: result.session }, seconds, config.key), seconds),
    responseCookie(flowCookie, '', 0),
  ]);
  connectionPage(res, 'Đang mở Narra Affiliate', 'Bạn đã xác thực quyền truy cập.', target, `
    const next = new URL(document.getElementById('continue').href);
    try {
      const fragment = sessionStorage.getItem('narra-vercel-fragment');
      sessionStorage.removeItem('narra-vercel-fragment');
      if (fragment && fragment.startsWith('#/')) next.hash = fragment;
    } catch {}
    location.replace(next.href);`);
}

async function forwardPortal(req, res, url, access, config, method = req.method) {
  if (!access?.session && url.pathname.startsWith('/api/admin/')) {
    return json(res, 403, { error: 'Thao tác này dành cho Quản trị viên.' });
  }
  const headers = {};
  let visitorCookieValue;
  if (access?.session) headers['x-narra-session'] = access.session;
  else {
    let visitor = readSigned(cookieFrom(req, visitorCookie), config.key)?.visitor;
    if (!/^[a-f\d]{64}$/.test(visitor ?? '')) {
      visitor = randomBytes(32).toString('hex');
      visitorCookieValue = responseCookie(visitorCookie, signedValue({ visitor }, hostSessionSeconds, config.key), hostSessionSeconds);
      res.setHeader('set-cookie', visitorCookieValue);
    }
    headers['x-narra-visitor'] = visitor;
    const address = req.headers['x-vercel-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown';
    headers['x-narra-rate-key'] = signature(String(address), config.key).toString('hex');
  }
  const appSession = cookieFrom(req, portalCookie);
  if (/^[a-f\d]{64}$/.test(appSession)) headers.cookie = portalCookie + '=' + appSession;
  let body;
  if (method === 'POST') {
    const type = req.headers['content-type']?.toLowerCase();
    if (!type?.startsWith('application/json')) return json(res, 400, { error: 'Dữ liệu gửi lên chưa đúng định dạng.' });
    if (req.headers.origin && req.headers.origin !== config.origin) return json(res, 403, { error: authError });
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 300_000) return json(res, 413, { error: 'Yêu cầu vượt quá dung lượng cho phép.' });
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks);
    headers['content-type'] = type;
    headers.origin = config.origin;
  }
  const upstream = await sitesRequest(config, (access?.session ? '/relay' : '/partner') + url.pathname + url.search, { method, headers, body });
  const proof = upstream.headers.get(relayHeader);
  if (proof === 'expired') {
    res.setHeader('set-cookie', responseCookie(accessCookie, '', 0));
    return method === 'HEAD' ? redirect(res, '/') : json(res, 401, { error: authError });
  }
  if (proof !== 'verified') return json(res, 502, { error: relayError });
  if (method === 'HEAD') {
    if (upstream.status === 303) return redirect(res, '/');
    if (!upstream.ok) return json(res, upstream.status, { error: relayError });
    return writeAsset(res, '/index.html', req.method);
  }
  const cookies = upstream.headers.getSetCookie().filter(value => value.startsWith(portalCookie + '='));
  if (cookies.length) res.setHeader('set-cookie', [...(visitorCookieValue ? [visitorCookieValue] : []), ...cookies]);
  send(res, upstream.status, Buffer.from(await upstream.arrayBuffer()), 'application/json; charset=utf-8');
}

function writeAsset(res, path, method) {
  const asset = Object.hasOwn(assets, path) ? assets[path] : null;
  if (!asset) return send(res, 404, 'Không tìm thấy trang.');
  return send(res, 200, method === 'HEAD' ? undefined : Buffer.from(asset[1], 'base64'), asset[0]);
}

export default async function portal(req, res) {
  res.setHeader('cache-control', 'private, no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'same-origin');
  res.setHeader('x-frame-options', 'DENY');
  const { NARRA_VERCEL_ORIGIN: origin, NARRA_SITES_SERVICE_TOKEN: siteToken, NARRA_VERCEL_SESSION_KEY: secret } = process.env;
  if (!/^https:\/\/[a-z\d-]+\.vercel\.app$/.test(origin ?? '') || !siteToken || !/^[a-f\d]{64}$/.test(secret ?? '')) {
    return send(res, 503, 'Cổng Narra Affiliate đang được thiết lập.');
  }
  const config = { origin, siteToken, key: Buffer.from(secret, 'hex') };
  try {
    const url = new URL(req.url, origin);
    if (url.origin !== origin) return send(res, 400, 'Địa chỉ không hợp lệ.');
    const routed = url.pathname === '/api/portal' ? url.searchParams.get('__narra_path') : null;
    if (routed !== null) {
      url.pathname = '/' + routed.replace(/^\/+/, '');
      url.searchParams.delete('__narra_path');
    }
    if (req.headers.host !== new URL(origin).host) return redirect(res, url.href, 308);
    url.searchParams.delete('__narra_path');
    const method = req.method;
    if (url.pathname === vercelCallback && method === 'GET') return await finishAccess(req, res, url, config);
    const access = readSigned(cookieFrom(req, accessCookie), config.key);
    if (url.pathname === '/auth/sites/start' && method === 'GET') {
      return startAccess(res, new URL('/', origin), config.key);
    }
    if (url.pathname === '/api/auth/merchant' && method === 'POST' && !access?.session) {
      return json(res, 200, { redirect: '/auth/sites/start' });
    }
    if (url.pathname.startsWith('/api/') && ['GET', 'POST'].includes(method)) {
      return await forwardPortal(req, res, url, access, config);
    }
    if (method !== 'GET' && method !== 'HEAD') return send(res, 405, 'Phương thức chưa được hỗ trợ.');
    if ((url.pathname === '/' || url.pathname === '/portal') && url.searchParams.has('ref')) return redirect(res, '/r' + url.search);
    if (url.pathname === '/') return writeAsset(res, '/landing.html', method);
    if (url.pathname === '/r' && url.searchParams.has('ref')) return writeAsset(res, '/index.html', method);
    if (url.pathname === '/portal') return await forwardPortal(req, res, url, access, config, 'HEAD');
    if (url.pathname.endsWith('.html')) return send(res, 404, 'Không tìm thấy trang.');
    return writeAsset(res, url.pathname, method);
  } catch (error) {
    console.error('Narra Vercel portal request failed', error.name);
    return json(res, 502, { error: relayError });
  }
}

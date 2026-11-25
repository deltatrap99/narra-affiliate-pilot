import assets from 'portal-assets';
import {
  PortalError, bad, forbidden, changed, now, json, inputJson, seal, unseal, emailIndex, digest,
  randomToken, hashPassword, equalDigest, requireIdentity, readSession, requireSession, issueSession, endSession, clearCookie, throttle,
} from './security.js';
import { applicationFields, codeField, emailField, passwordField, editableFields } from './fields.js';
import { vercelConnection } from './hosting.js';
import { connectVercel } from './vercel-link.js';

const groups = new Set(['DSGD', 'DSSV']);
const selectAccount = (env, id) => env.DB.prepare('SELECT * FROM portal_accounts WHERE id = ?').bind(id).first();
const approvedAccounts = env => env.DB.prepare("SELECT id, code, payload, created_at FROM portal_accounts WHERE status = 'approved' ORDER BY reviewed_at DESC").all();

function accountView(row, profile, full = false) {
  const result = {
    id: row.id, code: row.code, name: profile.name, email: profile.email, phone: profile.phone,
    group: profile.group, bank: profile.bank || '', bankLast4: profile.bankLast4 || '', portalAccount: true,
    joined: new Date((row.created_at + 7 * 60 * 60) * 1000).toISOString().slice(0, 10),
  };
  if (full) {
    result.bankAccount = profile.bankAccount || '';
    result.avatar = profile.avatar || '';
    result.verification = Boolean(profile.verification);
  }
  return result;
}

async function accountResponse(env, request) {
  const session = await readSession(env, request);
  if (!session) return json({ session: null });
  if (session.role === 'affiliate') {
    const row = await selectAccount(env, session.account_id);
    return json({ session: { role: session.role, account: accountView(row, await unseal(env, row.payload), true) } });
  }
  const rows = await approvedAccounts(env);
  const partners = await Promise.all(rows.results.map(async row => accountView(row, await unseal(env, row.payload))));
  return json({ session: { role: 'merchant', partners } });
}

async function apply(env, request, input) {
  await throttle(env, request, 'apply', 10);
  const record = applicationFields(input);
  const password = passwordField(input);
  const salt = randomToken(16);
  const key = await emailIndex(env, record.email);
  const [payload, hashed] = await Promise.all([seal(env, record), hashPassword(env, password, salt)]);
  const result = await env.DB.prepare(`INSERT INTO portal_accounts (id, code, email_key, payload, salt, password_hash, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    ON CONFLICT(email_key) DO UPDATE SET payload=excluded.payload, salt=excluded.salt, password_hash=excluded.password_hash,
      status='pending', created_at=excluded.created_at, reviewed_at=NULL WHERE portal_accounts.status='rejected'
    RETURNING code`)
    .bind('PT-' + crypto.randomUUID(), 'NAR-' + randomToken(5).toUpperCase(), key, payload, salt, hashed, now()).first();
  if (!result) throw new PortalError(409, 'Đã có hồ sơ với email này. Hãy dùng mã đã nhận hoặc chọn Quên mật khẩu.');
  return json({ code: result.code }, 201);
}

async function login(env, request, input) {
  await throttle(env, request, 'login', 12);
  const code = codeField(input);
  const password = passwordField(input, false);
  const row = await env.DB.prepare('SELECT id, salt, password_hash, status FROM portal_accounts WHERE code = ?').bind(code).first();
  const verified = await hashPassword(env, password, row?.salt ?? '00000000000000000000000000000000');
  if (!row || !equalDigest(verified, row.password_hash)) throw new PortalError(401, 'Mã đối tác hoặc mật khẩu chưa đúng.');
  if (row.status !== 'approved') throw new PortalError(403, row.status === 'pending' ? 'Hồ sơ đang chờ Quản trị viên duyệt.' : 'Hồ sơ chưa được duyệt. Bạn có thể gửi lại yêu cầu cấp mã.');
  return json({ role: 'affiliate' }, 200, { 'set-cookie': await issueSession(env, request, 'affiliate', row) });
}

async function merchantLogin(env, request) {
  const identity = requireIdentity(request);
  const email = request.headers.get('oai-authenticated-user-email')?.toLowerCase();
  if (email && email === env.PORTAL_OWNER_EMAIL?.toLowerCase()) {
    await env.DB.prepare('INSERT OR IGNORE INTO portal_owner (slot, identity) VALUES (1, ?)').bind(identity).run();
  }
  const owner = await env.DB.prepare('SELECT identity FROM portal_owner WHERE slot = 1').first();
  if (owner?.identity !== identity) throw forbidden();
  return json({ role: 'merchant' }, 200, { 'set-cookie': await issueSession(env, request, 'merchant') });
}

async function recover(env, request, input) {
  await throttle(env, request, 'recover', 8);
  const code = codeField(input);
  const email = await emailIndex(env, emailField(input));
  await env.DB.prepare(`INSERT OR IGNORE INTO portal_resets (id, account_id, status, requested_at)
    SELECT ?, a.id, 'pending', ? FROM portal_accounts AS a WHERE a.code = ? AND a.email_key = ? AND a.status = 'approved'
      AND NOT EXISTS (SELECT 1 FROM portal_resets WHERE account_id = a.id AND status = 'issued' AND expires_at > ?)`)
    .bind(crypto.randomUUID(), now(), code, email, now()).run();
  return json({ received: true }, 202);
}

async function reset(env, request, input) {
  await throttle(env, request, 'reset', 8);
  if (typeof input.token !== 'string' || !/^[a-f\d]{64}$/.test(input.token)) throw bad('Link đặt lại không hợp lệ.');
  const password = passwordField(input);
  const token = await digest(input.token);
  const active = "SELECT account_id FROM portal_resets WHERE token_hash = ? AND status = 'issued' AND expires_at > ?";
  if (!await env.DB.prepare(active).bind(token, now()).first()) throw new PortalError(410, 'Link đặt lại đã hết hạn hoặc đã được dùng.');
  const salt = randomToken(16);
  const hashed = await hashPassword(env, password, salt);
  const time = now();
  const updates = await env.DB.batch([
    env.DB.prepare(`UPDATE portal_accounts SET salt = ?, password_hash = ? WHERE id = (${active})`).bind(salt, hashed, token, time),
    env.DB.prepare(`DELETE FROM portal_sessions WHERE account_id = (${active})`).bind(token, time),
    env.DB.prepare("UPDATE portal_resets SET status = 'used' WHERE token_hash = ? AND status = 'issued' AND expires_at > ?").bind(token, time),
  ]);
  if (!changed(updates[2])) throw new PortalError(410, 'Link đặt lại đã hết hạn hoặc đã được dùng.');
  return json({ updated: true }, 200, { 'set-cookie': clearCookie() });
}

async function applicationList(env) {
  const rows = await env.DB.prepare(`SELECT id, code, payload, status, created_at FROM portal_accounts
    ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 100`).all();
  return json({ applications: await Promise.all(rows.results.map(async row => {
    const { name, email, phone, province } = await unseal(env, row.payload);
    return { id: row.id, code: row.code, status: row.status, createdAt: row.created_at, name, email, phone, province };
  })) });
}

async function application(env, id) {
  const row = await selectAccount(env, id);
  if (!row) throw new PortalError(404, 'Không tìm thấy hồ sơ đối tác.');
  const profile = await unseal(env, row.payload);
  const { bank, bankAccount, bankLast4, ...request } = profile;
  return json({ application: { ...request, id: row.id, code: row.code, status: row.status, createdAt: row.created_at } });
}

async function review(env, id, input) {
  if (!['approve', 'reject'].includes(input.decision)) throw bad('Chọn cách xử lý hồ sơ.');
  const row = await selectAccount(env, id);
  if (row?.status !== 'pending') throw new PortalError(409, 'Hồ sơ đã được xử lý.');
  const data = await unseal(env, row.payload);
  const status = input.decision === 'approve' ? 'approved' : 'rejected';
  if (input.group && !groups.has(input.group)) throw bad('Kiểm tra lại nhóm đối tác.');
  if (status === 'approved' && input.group) data.group = input.group;
  const result = await env.DB.prepare("UPDATE portal_accounts SET payload = ?, status = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'")
    .bind(await seal(env, data), status, now(), id).run();
  if (!changed(result)) throw new PortalError(409, 'Hồ sơ đã được xử lý.');
  return json({ status, code: row.code, account: status === 'approved' ? accountView(row, data) : null });
}

async function resetList(env) {
  const rows = await env.DB.prepare(`SELECT r.id, r.requested_at, a.code, a.payload FROM portal_resets AS r
    JOIN portal_accounts AS a ON a.id = r.account_id WHERE r.status = 'pending' ORDER BY r.requested_at DESC LIMIT 100`).all();
  return json({ resets: await Promise.all(rows.results.map(async row => {
    const { name, email } = await unseal(env, row.payload);
    return { id: row.id, code: row.code, requestedAt: row.requested_at, name, email };
  })) });
}
async function issueReset(env, id) {
  const token = randomToken();
  const row = await env.DB.prepare(`UPDATE portal_resets SET status = 'issued', token_hash = ?, expires_at = ?
    WHERE id = ? AND status = 'pending' RETURNING account_id`).bind(await digest(token), now() + 60 * 60, id).first();
  if (!row) throw new PortalError(409, 'Yêu cầu đã được xử lý.');
  return json({ path: '/#/dat-lai/' + token });
}

async function partnerProfile(env, id, session, input) {
  if (session.role !== 'merchant' && session.account_id !== id) throw forbidden();
  const row = await selectAccount(env, id);
  if (row?.status !== 'approved') throw new PortalError(404, 'Không tìm thấy đối tác.');
  const before = await unseal(env, row.payload);
  if (!input) return json({ account: accountView(row, before, true) });
  const fields = editableFields(input);
  const code = session.role === 'merchant' ? codeField(input) : row.code;
  const key = await emailIndex(env, fields.email);
  const profile = { ...before, ...fields };
  if (profile.bank !== (before.bank || '') || profile.bankAccount !== (before.bankAccount || '')) {
    profile.verification = Boolean(profile.bank && profile.bankAccount);
  }
  try {
    const result = await env.DB.prepare("UPDATE portal_accounts SET payload = ?, code = ?, email_key = ? WHERE id = ? AND payload = ? AND status = 'approved'")
      .bind(await seal(env, profile), code, key, id, row.payload).run();
    if (!changed(result)) throw new PortalError(409, 'Hồ sơ vừa được cập nhật. Mở lại hồ sơ trước khi lưu.');
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint')) throw new PortalError(409, 'Mã đối tác hoặc email đã được sử dụng.');
    throw error;
  }
  return json({ account: accountView({ ...row, code }, profile, true) });
}

async function api(env, request, path) {
  requireIdentity(request);
  const method = request.method;
  if (path === '/api/session' && method === 'GET') return accountResponse(env, request);
  const input = method === 'POST' ? await inputJson(request) : null;
  if (method === 'POST') {
    if (path === '/api/auth/apply') return apply(env, request, input);
    if (path === '/api/auth/login') return login(env, request, input);
    if (path === '/api/auth/merchant') return merchantLogin(env, request);
    if (path === '/api/auth/recover') return recover(env, request, input);
    if (path === '/api/auth/reset') return reset(env, request, input);
    if (path === '/api/auth/logout') {
      await endSession(env, request);
      return json({ loggedOut: true }, 200, { 'set-cookie': clearCookie() });
    }
  }
  if (path.startsWith('/api/admin/')) {
    await requireSession(env, request, 'merchant');
    const [, , , section, id] = path.split('/');
    if (section === 'applications') {
      if (method === 'GET') return id ? application(env, id) : applicationList(env);
      if (method === 'POST' && id) return review(env, id, input);
    }
    if (section === 'resets') {
      if (method === 'GET' && !id) return resetList(env);
      if (method === 'POST' && id) return issueReset(env, id);
    }
  }
  const profile = /^\/api\/partners\/(PT-[a-f\d-]+)$/.exec(path);
  if (profile && ['GET', 'POST'].includes(method)) return partnerProfile(env, profile[1], await requireSession(env, request), input);
  return json({ error: 'Không tìm thấy chức năng này.' }, 404);
}

function asset(path, request, isPage = false) {
  const entry = Object.hasOwn(assets, path) ? assets[path] : null;
  if (!entry) return new Response('Không tìm thấy trang.', { status: 404 });
  const [type, encoded] = entry;
  return new Response(request.method === 'HEAD' ? null : Uint8Array.from(atob(encoded), char => char.charCodeAt(0)), {
    headers: {
      'content-type': type,
      'cache-control': isPage ? 'no-store' : 'public, max-age=300',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'same-origin',
      'x-frame-options': 'DENY',
    },
  });
}
const redirect = location => new Response(null, { status: 303, headers: { location, 'cache-control': 'no-store' } });

async function servePortal(request, env, url = new URL(request.url)) {
  const { pathname } = url;
  if (pathname.startsWith('/api/')) return api(env, request, pathname);
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Phương thức chưa được hỗ trợ.', { status: 405 });
  if ((pathname === '/' || pathname === '/portal') && url.searchParams.has('ref')) return redirect('/r' + url.search);
  if (pathname === '/') return asset('/landing.html', request, true);
  if (pathname === '/portal') return (await readSession(env, request)) ? asset('/index.html', request, true) : redirect('/');
  if (pathname === '/r' && url.searchParams.has('ref')) return asset('/index.html', request, true);
  if (!pathname.endsWith('.html')) return asset(pathname, request);
  return redirect('/');
}

function requestError(error) {
  if (error instanceof PortalError) return json({ error: error.message }, error.status);
  console.error('Narra portal request failed', error.name);
  return json({ error: 'Chưa thể xử lý yêu cầu. Vui lòng thử lại.' }, 500);
}

async function portalResponse(request, env, url) {
  try { return await servePortal(request, env, url); }
  catch (error) { return requestError(error); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith(vercelConnection + '/')) return await connectVercel(request, env, url, portalResponse);
      return await portalResponse(request, env, url);
    } catch (error) {
      return requestError(error);
    }
  },
};

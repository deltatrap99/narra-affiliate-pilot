const encoder = new TextEncoder();
const decoder = new TextDecoder();
const sessionPeriod = 8 * 60 * 60;
const cookieName = '__Host-narra_portal';

export class PortalError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const bad = message => new PortalError(400, message);
export const forbidden = () => new PortalError(403, 'Bạn không có quyền thực hiện thao tác này.');
export const changed = result => Number(result.meta.changes) > 0;
export const now = () => Math.floor(Date.now() / 1000);

export function json(body, status = 200, more = {}) {
  return new Response(JSON.stringify(body), { status, headers: {
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...more,
  } });
}

export async function inputJson(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw bad('Dữ liệu gửi lên chưa đúng định dạng.');
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw forbidden();
  const reader = request.body?.getReader();
  if (!reader) throw bad('Thiếu dữ liệu yêu cầu.');
  let size = 0;
  let text = '';
  const utf8 = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 300_000) { await reader.cancel(); throw new PortalError(413, 'Yêu cầu vượt quá dung lượng cho phép.'); }
    text += utf8.decode(value, { stream: true });
  }
  text += utf8.decode();
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { throw bad('Dữ liệu gửi lên chưa đúng định dạng.'); }
}

const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
const unhex = value => Uint8Array.from(value.match(/.{2}/g), byte => parseInt(byte, 16));
export const randomToken = (length = 32) => hex(crypto.getRandomValues(new Uint8Array(length)));
export const digest = async value => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
const fromBase64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

let keySource;
let keys;
async function deriveKeys(source) {
  const master = await crypto.subtle.importKey('raw', unhex(source), 'HKDF', false, ['deriveKey']);
  const derive = (scope, algorithm, usage) => crypto.subtle.deriveKey({
    name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('narra-portal-v1'), info: encoder.encode(scope),
  }, master, algorithm, false, usage);
  return Promise.all([
    derive('profile', { name: 'AES-GCM', length: 256 }, ['encrypt', 'decrypt']),
    derive('index-password', { name: 'HMAC', hash: 'SHA-256', length: 256 }, ['sign']),
  ]);
}
function portalKeys(env) {
  if (!/^[a-f\d]{64}$/i.test(env.PORTAL_KEY ?? '')) throw new PortalError(503, 'Cổng đăng nhập đang được thiết lập.');
  if (keySource !== env.PORTAL_KEY) {
    keySource = env.PORTAL_KEY;
    keys = deriveKeys(keySource);
  }
  return keys;
}
export async function seal(env, data) {
  const [key] = await portalKeys(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(data)));
  return toBase64(iv) + '.' + toBase64(new Uint8Array(sealed));
}
export async function unseal(env, payload) {
  const [key] = await portalKeys(env);
  const [iv, sealed] = payload.split('.');
  return JSON.parse(decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(sealed))));
}

async function keyed(env, scope, value) {
  const [, key] = await portalKeys(env);
  return crypto.subtle.sign('HMAC', key, encoder.encode(scope + '\0' + value));
}
export const emailIndex = async (env, email) => hex(await keyed(env, 'email', email.toLowerCase()));
export async function hashPassword(env, password, salt) {
  const value = await keyed(env, 'password', password);
  const key = await crypto.subtle.importKey('raw', value, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(salt), iterations: 100_000 }, key, 256);
  return hex(bits);
}
export function equalDigest(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export function requireIdentity(request) {
  const id = request.headers.get('oai-authenticated-user-id');
  if (!id) throw new PortalError(401, 'Phiên truy cập Sites chưa được xác thực.');
  return id;
}

const tokenFrom = request => request.headers.get('cookie')?.split(';').map(item => item.trim())
  .find(item => item.startsWith(cookieName + '='))?.slice(cookieName.length + 1) ?? '';
const cookie = (value, maxAge) => `${cookieName}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
export const clearCookie = () => cookie('', 0);

export async function readSession(env, request) {
  const token = tokenFrom(request);
  const identity = request.headers.get('oai-authenticated-user-id');
  if (!identity || !/^[a-f\d]{64}$/.test(token)) return null;
  return env.DB.prepare(`SELECT s.role, s.account_id, a.code
    FROM portal_sessions AS s LEFT JOIN portal_accounts AS a ON a.id = s.account_id
    WHERE s.token_hash = ? AND s.identity = ? AND s.expires_at > ?
      AND (s.role = 'merchant' OR a.status = 'approved')`)
    .bind(await digest(token), identity, now()).first();
}
export async function requireSession(env, request, role) {
  const session = await readSession(env, request);
  if (!session) throw new PortalError(401, 'Bạn cần đăng nhập để tiếp tục.');
  if (role && role !== session.role) throw forbidden();
  return session;
}
export async function endSession(env, request) {
  const token = tokenFrom(request);
  if (/^[a-f\d]{64}$/.test(token)) {
    await env.DB.prepare('DELETE FROM portal_sessions WHERE token_hash = ? AND identity = ?')
      .bind(await digest(token), requireIdentity(request)).run();
  }
}
export async function issueSession(env, request, role, account = null) {
  const identity = requireIdentity(request);
  const token = randomToken();
  const existing = tokenFrom(request);
  const hash = await digest(token);
  const expiry = now() + sessionPeriod;
  const insert = account ? env.DB.prepare(`INSERT INTO portal_sessions
    SELECT ?, ?, id, ?, ? FROM portal_accounts WHERE id = ? AND password_hash = ? AND status = 'approved'`)
    .bind(hash, role, identity, expiry, account.id, account.password_hash)
    : env.DB.prepare('INSERT INTO portal_sessions VALUES (?, ?, NULL, ?, ?)').bind(hash, role, identity, expiry);
  const operations = [
    insert,
    env.DB.prepare('DELETE FROM portal_sessions WHERE expires_at <= ?').bind(now()),
  ];
  if (/^[a-f\d]{64}$/.test(existing)) {
    operations.push(env.DB.prepare(`DELETE FROM portal_sessions WHERE token_hash = ? AND identity = ?
      AND EXISTS (SELECT 1 FROM portal_sessions WHERE token_hash = ?)`).bind(await digest(existing), identity, hash));
  }
  const [result] = await env.DB.batch(operations);
  if (!changed(result)) throw new PortalError(409, 'Thông tin đăng nhập vừa thay đổi. Vui lòng thử lại.');
  return cookie(token, sessionPeriod);
}

export async function throttle(env, request, action, max) {
  const bucket = action + ':' + await digest(requireIdentity(request));
  const window = Math.floor(now() / 600);
  const row = await env.DB.prepare(`INSERT INTO portal_limits (bucket, window, count) VALUES (?, ?, 1)
    ON CONFLICT(bucket) DO UPDATE SET count = CASE WHEN portal_limits.window = excluded.window THEN portal_limits.count + 1 ELSE 1 END,
    window = excluded.window RETURNING count`).bind(bucket, window).first();
  if (row.count > max) throw new PortalError(429, 'Bạn đã thử nhiều lần. Hãy thử lại sau ít phút.');
}

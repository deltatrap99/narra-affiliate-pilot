import { PortalError, bad, forbidden, now, json, inputJson, seal, unseal, digest,
  equalDigest, requireIdentity } from './security.js';
import { vercelConnection, vercelCallback, relayHeader, hostSessionSeconds } from './hosting.js';

const hex = /^[a-f\d]{64}$/;

function allowedOrigin(env) {
  const origin = env.NARRA_VERCEL_ORIGIN;
  if (!/^https:\/\/[a-z\d-]+\.vercel\.app$/.test(origin ?? '')) {
    throw new PortalError(404, 'Không tìm thấy chức năng này.');
  }
  return origin;
}

async function openGrant(env, opaque, kind, origin) {
  if (typeof opaque !== 'string' || opaque.length > 2048 || !/^[a-z\d+/]+=*\.[a-z\d+/]+=*$/i.test(opaque)) return null;
  try {
    const grant = await unseal(env, opaque);
    if (grant.kind === kind && grant.origin === origin && typeof grant.user === 'string' &&
      grant.user && Number.isSafeInteger(grant.expires) && grant.expires > now()) return grant;
  } catch {}
  return null;
}

async function authorize(request, env, url, origin) {
  const user = requireIdentity(request);
  const challenge = url.searchParams.get('challenge') ?? '';
  if (!hex.test(challenge)) throw bad('Yêu cầu kết nối không hợp lệ.');
  const email = request.headers.get('oai-authenticated-user-email') || '';
  const ticket = await seal(env, { kind: 'vercel-handoff', origin, user, email, challenge, expires: now() + 120 });
  const target = new URL(vercelCallback, origin);
  target.searchParams.set('ticket', ticket);
  return new Response(null, { status: 303, headers: {
    location: target.href, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer',
  } });
}

async function exchange(request, env, origin) {
  const { ticket, proof } = await inputJson(request);
  const grant = await openGrant(env, ticket, 'vercel-handoff', origin);
  if (!grant || typeof proof !== 'string' || !hex.test(proof) ||
    !equalDigest(await digest(proof), grant.challenge)) throw forbidden();
  const expires = now() + hostSessionSeconds;
  const session = await seal(env, { kind: 'vercel-session', origin, user: grant.user, email: grant.email, expires });
  return json({ session, expires });
}

export async function connectVercel(request, env, url, servePortal) {
  const origin = allowedOrigin(env);
  const path = url.pathname.slice(vercelConnection.length);
  if (path === '/authorize' && request.method === 'GET') return authorize(request, env, url, origin);

  // Service calls clear the visitor headers at Sites; only a Sites-issued grant establishes identity here.
  if (request.headers.has('oai-authenticated-user-id')) throw forbidden();
  if (path === '/exchange' && request.method === 'POST') return exchange(request, env, origin);
  if (!path.startsWith('/relay/')) throw new PortalError(404, 'Không tìm thấy chức năng này.');
  const targetPath = path.slice('/relay'.length);
  if (targetPath !== '/portal' && !targetPath.startsWith('/api/')) throw new PortalError(404, 'Không tìm thấy chức năng này.');

  const grant = await openGrant(env, request.headers.get('x-narra-session'), 'vercel-session', origin);
  if (!grant) return json({ error: 'Phiên truy cập Narra đã hết hạn.' }, 401, { [relayHeader]: 'expired' });
  const target = new URL(origin);
  target.pathname = targetPath;
  target.search = url.search;
  const headers = new Headers(request.headers);
  headers.set('oai-authenticated-user-id', grant.user);
  if (grant.email) headers.set('oai-authenticated-user-email', grant.email);
  else headers.delete('oai-authenticated-user-email');
  const response = await servePortal(new Request(target, {
    method: request.method, headers, body: request.body, duplex: 'half',
  }), env);
  const outgoing = new Headers(response.headers);
  outgoing.set(relayHeader, 'verified');
  return new Response(response.body, { status: response.status, headers: outgoing });
}

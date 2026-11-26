import { PortalError, bad, forbidden, now, json, unseal } from './security.js';

const states = new Set(['draft', 'published', 'paused']);
const groups = new Set(['all', 'DSGD', 'DSSV']);
const modes = new Set(['open', 'approval', 'auto']);
const kinds = new Set(['rate', 'fixed', 'multiplier']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

function text(input, key, label, limit, required = true) {
  const value = typeof input[key] === 'string' ? input[key].trim() : '';
  if ((required && !value) || value.length > limit) throw bad('Kiểm tra lại ' + label + '.');
  return value;
}

function amount(input, key, label, max) {
  const value = Number(input[key]);
  if (!Number.isFinite(value) || value < 0 || value > max) throw bad('Kiểm tra lại ' + label + '.');
  return value;
}

function goalsField(input) {
  if (input.goals === undefined || input.goals === null) return undefined;
  if (typeof input.goals !== 'object' || Array.isArray(input.goals)) throw bad('Kiểm tra lại mốc thi đua.');
  const entries = Object.entries(input.goals);
  if (entries.length > 12) throw bad('Kiểm tra lại mốc thi đua.');
  const goals = {};
  for (const [key, value] of entries) {
    if (!/^[a-zA-Z]{1,24}$/.test(key) || !Number.isFinite(Number(value)) || Number(value) < 0) throw bad('Kiểm tra lại mốc thi đua.');
    goals[key] = Number(value);
  }
  return goals;
}

export function campaignFields(input) {
  const id = text(input, 'id', 'mã chiến dịch', 32).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(id)) throw bad('Kiểm tra lại mã chiến dịch.');
  const start = text(input, 'start', 'ngày bắt đầu', 10);
  const end = text(input, 'end', 'ngày kết thúc', 10);
  if (!datePattern.test(start) || !datePattern.test(end) || end < start) throw bad('Kiểm tra lại thời gian chiến dịch.');
  const state = text(input, 'state', 'trạng thái', 16);
  const group = text(input, 'group', 'nhóm đối tác', 8);
  const mode = text(input, 'mode', 'cách tham gia', 16);
  const kind = text(input, 'kind', 'loại thưởng', 16);
  if (!states.has(state) || !groups.has(group) || !modes.has(mode) || !kinds.has(kind)) throw bad('Kiểm tra lại thông tin chiến dịch.');
  const value = amount(input, 'value', 'giá trị thưởng', kind === 'rate' ? 100 : kind === 'multiplier' ? 10 : 1e9);
  if (kind === 'fixed' && !Number.isInteger(value)) throw bad('Kiểm tra lại giá trị thưởng.');
  const goals = goalsField(input);
  return {
    id, name: text(input, 'name', 'tên chiến dịch', 120), start, end, group, state, mode, kind, value,
    target: amount(input, 'target', 'chỉ tiêu', 1e6), budget: amount(input, 'budget', 'ngân sách', 1e12),
    owner: text(input, 'owner', 'người phụ trách', 80), eligibleProduct: text(input, 'eligibleProduct', 'sản phẩm áp dụng', 80, false),
    combine: input.combine === true, description: text(input, 'description', 'thể lệ', 4000),
    ...(typeof input.publishedAt === 'string' && datePattern.test(input.publishedAt) ? { publishedAt: input.publishedAt } : {}),
    ...(goals ? { goals } : {}),
  };
}

async function accountGroup(env, accountId) {
  const row = await env.DB.prepare("SELECT payload FROM portal_accounts WHERE id = ? AND status = 'approved'").bind(accountId).first();
  if (!row) throw forbidden();
  return (await unseal(env, row.payload)).group;
}

async function membersFor(env, session) {
  const rows = session.role === 'merchant'
    ? await env.DB.prepare('SELECT campaign_id, account_id, status FROM portal_campaign_members').all()
    : await env.DB.prepare('SELECT campaign_id, account_id, status FROM portal_campaign_members WHERE account_id = ?').bind(session.account_id).all();
  const members = new Map();
  for (const row of rows.results) {
    if (!members.has(row.campaign_id)) members.set(row.campaign_id, {});
    members.get(row.campaign_id)[row.account_id] = row.status;
  }
  return members;
}

export async function campaignList(env, session) {
  const merchant = session.role === 'merchant';
  const rows = merchant
    ? await env.DB.prepare('SELECT id, payload FROM portal_campaigns ORDER BY created_at DESC').all()
    : await env.DB.prepare("SELECT id, payload FROM portal_campaigns WHERE state != 'draft' ORDER BY created_at DESC").all();
  let group = null;
  if (!merchant) group = await accountGroup(env, session.account_id);
  const members = await membersFor(env, session);
  const campaigns = rows.results.map(row => ({ ...JSON.parse(row.payload), members: members.get(row.id) ?? {} }))
    .filter(campaign => merchant || campaign.group === 'all' || campaign.group === group);
  return json({ campaigns });
}

async function autoEnroll(env, campaign) {
  if (campaign.state !== 'published' || campaign.mode !== 'auto') return;
  const rows = await env.DB.prepare("SELECT id, payload FROM portal_accounts WHERE status = 'approved'").all();
  const time = now();
  const statements = [];
  for (const row of rows.results) {
    const { group } = await unseal(env, row.payload);
    if (campaign.group !== 'all' && campaign.group !== group) continue;
    statements.push(env.DB.prepare(`INSERT INTO portal_campaign_members (campaign_id, account_id, status, updated_at)
      VALUES (?, ?, 'joined', ?) ON CONFLICT(campaign_id, account_id) DO UPDATE SET status = 'joined', updated_at = excluded.updated_at`)
      .bind(campaign.id, row.id, time));
  }
  if (statements.length) await env.DB.batch(statements);
}

export async function saveCampaign(env, input) {
  const campaign = campaignFields(input ?? {});
  const existing = await env.DB.prepare('SELECT state, payload FROM portal_campaigns WHERE id = ?').bind(campaign.id).first();
  if (existing && existing.state === 'published' && campaign.state === 'draft') throw bad('Chiến dịch đã công bố không thể quay lại bản nháp.');
  if (campaign.state === 'published' && campaign.end < today()) throw bad('Cập nhật thời gian kết thúc trước khi công bố.');
  const time = now();
  await env.DB.prepare(`INSERT INTO portal_campaigns (id, payload, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, state = excluded.state, updated_at = excluded.updated_at`)
    .bind(campaign.id, JSON.stringify(campaign), campaign.state, time, time).run();
  await autoEnroll(env, campaign);
  return json({ campaign });
}

async function publishedCampaign(env, id) {
  const row = await env.DB.prepare('SELECT payload FROM portal_campaigns WHERE id = ?').bind(id).first();
  if (!row) throw new PortalError(404, 'Không tìm thấy chiến dịch.');
  return JSON.parse(row.payload);
}

export async function joinCampaign(env, session, id) {
  if (session.role !== 'affiliate') throw forbidden();
  const campaign = await publishedCampaign(env, id);
  const group = await accountGroup(env, session.account_id);
  if (campaign.state !== 'published' || campaign.end < today() || (campaign.group !== 'all' && campaign.group !== group)) {
    throw new PortalError(409, 'Chưa thể đăng ký chiến dịch này.');
  }
  const status = campaign.mode === 'approval' ? 'pending' : 'joined';
  const result = await env.DB.prepare(`INSERT OR IGNORE INTO portal_campaign_members (campaign_id, account_id, status, updated_at)
    VALUES (?, ?, ?, ?)`).bind(id, session.account_id, status, now()).run();
  if (!Number(result.meta.changes)) throw new PortalError(409, 'Bạn đã đăng ký chiến dịch này.');
  return json({ status });
}

export async function approveMember(env, id, accountId) {
  if (!/^PT-[a-f\d-]+$/.test(accountId ?? '')) throw bad('Kiểm tra lại đối tác.');
  const result = await env.DB.prepare(`UPDATE portal_campaign_members SET status = 'joined', updated_at = ?
    WHERE campaign_id = ? AND account_id = ? AND status = 'pending'`).bind(now(), id, accountId).run();
  if (!Number(result.meta.changes)) throw new PortalError(409, 'Đăng ký này đã được xử lý.');
  return json({ status: 'joined' });
}

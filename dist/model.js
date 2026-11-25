export const TODAY = '2026-11-25';
const DAY = 86_400_000;
const localStore = 'narra-affiliate-pilot-v1';

export const GROUPS = {
  DSGD: 'Đại sứ giáo dục',
  DSSV: 'Đại sứ sinh viên',
};

const integerFormat = new Intl.NumberFormat('vi-VN');
const percentFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
export const number = value => integerFormat.format(value);
export const money = value => `${number(value)} ₫`;
export const percent = value => `${percentFormat.format(value)}%`;
export function date(value, full = true) {
  if (!value) return 'Chưa có';
  const [year, month, day] = value.split('-');
  return full ? `${day}/${month}/${year}` : `${day}/${month}`;
}
export const addDays = (value, days) => new Date(Date.parse(value) + days * DAY).toISOString().slice(0, 10);
export const numDays = (start, end) => Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1;
export const includesDate = (value, range) => Boolean(value && value >= range.start && value <= range.end);
export const initialRange = { start: addDays(TODAY, -29), end: TODAY, preset: '30' };
export const presets = {
  7: { start: addDays(TODAY, -6), end: TODAY, preset: '7' },
  30: initialRange,
  month: { start: '2026-11-01', end: TODAY, preset: 'month' },
};

const people = [
  { id: 'AF-001', name: 'Minh Anh', group: 'DSGD', status: 'active', joined: '2026-09-30', channel: 'Facebook', tone: 'violet' },
  { id: 'AF-002', name: 'Lan Chi', group: 'DSSV', status: 'active', joined: '2026-10-01', channel: 'TikTok', tone: 'green' },
  { id: 'AF-003', name: 'Đức Hoàng', group: 'DSGD', status: 'active', joined: '2026-10-04', channel: 'Facebook', tone: 'blue' },
  { id: 'AF-004', name: 'Huyền Trang', group: 'DSSV', status: 'active', joined: '2026-10-11', channel: 'Instagram', tone: 'pink' },
  { id: 'AF-005', name: 'Quân Nguyễn', group: 'DSGD', status: 'active', joined: '2026-10-15', channel: 'YouTube', tone: 'gold' },
  { id: 'AF-006', name: 'Tú Anh', group: 'DSSV', status: 'pending', joined: '2026-11-23', channel: 'TikTok', tone: 'violet' },
  { id: 'AF-007', name: 'Bảo Ngọc', group: 'DSGD', status: 'pending', joined: '2026-11-25', channel: 'Facebook', tone: 'green' },
];

export const PARTNER_ID = 'AF-001';

function seed() {
  const partners = people.map(p => ({ ...p }));
  const campaigns = [
    { id: 'GOLDEN26', name: 'Golden Days', start: '2026-12-12', end: '2026-12-15', group: 'all', state: 'published', mode: 'open', kind: 'multiplier', value: 2, target: 3, budget: 3000000, owner: 'Narra Admin', eligibleProduct: 'Narra Plus', combine: false, description: 'Trong bốn ngày Golden Days, Đại sứ nhận gấp đôi hoa hồng cho đơn Narra Plus mua lần đầu đủ điều kiện.', members: {} },
    { id: 'BTS26', name: 'Back to School', start: '2026-11-10', end: '2026-11-30', group: 'DSSV', state: 'published', mode: 'approval', kind: 'fixed', value: 10000, target: 3, budget: 1500000, owner: 'Narra Admin', eligibleProduct: 'Narra Plus', combine: false, description: 'Giới thiệu Narra đến sinh viên và nhận thêm 10.000 ₫ cho mỗi đơn Plus hợp lệ trong thời gian chiến dịch.', members: { 'AF-002': 'joined', 'AF-004': 'pending' } },
    { id: 'PLUS26', name: 'Narra Plus cùng Đại sứ', start: '2026-11-01', end: '2026-11-30', group: 'DSGD', state: 'published', mode: 'open', kind: 'rate', value: 18, target: 5, budget: 2500000, owner: 'Narra Admin', eligibleProduct: 'Narra Plus', combine: false, description: 'Đại sứ giáo dục có thể tham gia để nhận mức hoa hồng riêng cho đơn Narra Plus hợp lệ phát sinh trong tháng 11.', members: { 'AF-001': 'joined', 'AF-003': 'joined' } },
    { id: 'NARRA10', name: 'Khởi động cùng Narra', start: '2026-10-01', end: '2026-10-21', group: 'all', state: 'published', mode: 'open', kind: 'rate', value: 15, target: 4, budget: 1000000, owner: 'Narra Admin', eligibleProduct: 'Narra Plus', combine: false, description: 'Đợt khởi động hỗ trợ Đại sứ làm quen với công cụ giới thiệu và quy trình ghi nhận hoa hồng.', members: { 'AF-001': 'joined', 'AF-002': 'joined' } },
  ];
  const policies = [
    { id: 'v1.0', effective: '2026-09-01', DSGD: 12, DSSV: 12, attribution: 30, hold: 7, threshold: 50000, cadence: 'Hằng tháng', landing: '', enabled: true },
    { id: 'v1.1', effective: '2026-11-01', DSGD: 15, DSSV: 15, attribution: 30, hold: 7, threshold: 50000, cadence: 'Hằng tháng', landing: '', enabled: true },
  ];
  const links = partners.filter(p => p.status === 'active').flatMap((p, i) => {
    const codes = ['MINHANH', 'LANCHI', 'DUCHOANG', 'HUYENTRANG', 'QUANNGUYEN'];
    const main = { id: `LK-${i + 1}01`, partner: p.id, channel: p.channel, code: codes[i], campaign: '', created: p.joined, active: true, coupon: i === 0 ? 'NARRA-MINHANH' : '' };
    return i < 3 ? [main, { id: `LK-${i + 1}02`, partner: p.id, channel: i === 1 ? 'TikTok' : 'Facebook', code: `${codes[i]}-PLUS`, campaign: i === 1 ? 'BTS26' : 'PLUS26', created: '2026-11-10', active: true, coupon: '' }] : [main];
  });
  const activity = [];
  const orders = [];
  const start = '2026-09-29';
  for (let day = 0; day < numDays(start, TODAY); day++) {
    const at = addDays(start, day);
    partners.filter(p => p.status === 'active' && p.joined <= at).forEach((p, i) => {
      const partnerLinks = links.filter(l => l.partner === p.id && l.created <= at);
      const link = partnerLinks[day % partnerLinks.length];
      const cycle = [8, 15, 5, 1, 10, 20, 13][day % 7];
      const click = 18 + cycle + (i * 7 + day * 11) % 32 + Math.floor(day * .47) + (i === 0 ? 9 : 0);
      let l0 = Math.round(click * (.083 + (day + i) % 4 * .012));
      let free = Math.round(l0 * (.29 + (day * 3 + i) % 6 * .04));
      if (p.id === PARTNER_ID && day >= numDays(start, TODAY) - 7) {
        const weekDay = day - (numDays(start, TODAY) - 7);
        l0 = [4, 6, 5, 4, 7, 5, 7][weekDay];
        free = [1, 3, 2, 1, 3, 2, 3][weekDay];
      }
      activity.push({ at, partner: p.id, link: link.id, campaign: link.campaign, click, unique: Math.round(click * .88), l0, free });
      if ((day + i * 2) % (i === 0 ? 4 : 3 + i % 2) !== 0 || (i === 0 && at >= '2026-11-19')) return;
      const amount = (day + i) % 6 === 0 ? 599000 : (day + i) % 4 === 0 ? 399000 : 199000;
      const pending = at >= '2026-11-20' && (day + i) % 3 === 0;
      const approved = pending ? '' : addDays(at, Math.min(1, numDays(at, TODAY) - 1));
      const policy = policies[at >= '2026-11-01' ? 1 : 0];
      const campaign = campaigns.find(c => c.id === link.campaign && c.start <= at && c.end >= at && c.members[p.id] === 'joined');
      const rate = campaign?.kind === 'rate' ? campaign.value : policy[p.group];
      const bonus = campaign?.kind === 'fixed' ? campaign.value : 0;
      orders.push({
        id: `NR-${150 + orders.length}`, partner: p.id, link: link.id, campaign: campaign?.id ?? '',
        product: 'Narra Plus', created: at, paidAt: at, approved, holdDays: policy.hold,
        version: policy.id, amount, baseRate: policy[p.group], rate, bonus,
        status: pending ? 'pending' : 'approved', refund: 0, history: [{ at, text: 'Ghi nhận giao dịch từ link giới thiệu.' }, ...(approved ? [{ at: approved, text: 'Đã xác nhận chuyển đổi.' }] : [])],
      });
    });
  }
  const addExample = (id, at, status, extra = {}) => {
    const approved = status === 'pending' || status === 'rejected' ? '' : addDays(at, 1);
    orders.push({
      id, partner: PARTNER_ID, link: 'LK-101', campaign: '', product: 'Narra Plus',
      created: at, paidAt: at, approved, holdDays: 7, version: 'v1.1',
      amount: 199000, baseRate: 15, rate: 15, bonus: 0, status, refund: 0,
      history: [{ at, text: 'Ghi nhận giao dịch từ link giới thiệu.' }, ...(approved ? [{ at: approved, text: 'Đã xác nhận chuyển đổi.' }] : [])],
      ...extra,
    });
  };
  addExample('NR-308', '2026-11-24', 'pending', { conflict: true, attribution: 'Code MINHANH trùng với lượt giới thiệu từ link của cộng tác viên khác.' });
  addExample('NR-307', '2026-11-22', 'approved');
  addExample('NR-306', '2026-11-20', 'approved');
  addExample('NR-305', '2026-11-19', 'approved', { refund: 199000, refundedAt: '2026-11-22', reason: 'Đã hoàn toàn bộ giá trị giao dịch.' });
  const historic = orders.filter(o => o.approved && addDays(o.approved, 7) <= '2026-11-10');
  const paidEntries = historic.filter(o => o.paidAt >= '2026-10-20').map(o => ({ orderId: o.id, partner: o.partner, amount: commission(o) }));
  const batches = [{
    id: 'PO-2611-01', name: 'Kỳ 01/11 - 10/11', created: '2026-11-10', paidAt: '2026-11-12', ref: 'NARRA-1112', entries: paidEntries,
  }];
  return { partners, campaigns, policies, links, activity, orders, batches, adjustments: [], tickets: [], profile: { name: 'Minh Anh', email: '', bank: '', bankLast4: '', verification: '' }, audit: [] };
}

export function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(localStore));
    if (saved?.partners && saved.policies) return saved;
  } catch {}
  return seed();
}

export function saveState(data) {
  try {
    localStorage.setItem(localStore, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function policyAt(data, at = TODAY) {
  return data.policies.filter(p => p.effective <= at).sort((a, b) => b.effective.localeCompare(a.effective))[0];
}

export function campaignStatus(campaign, at = TODAY) {
  if (campaign.state !== 'published') return campaign.state;
  if (at < campaign.start) return 'scheduled';
  if (at > campaign.end) return 'ended';
  return 'live';
}

export function inAudience(campaign, partner) {
  return campaign.group === 'all' || campaign.group === partner.group;
}

export const holdEnd = order => order.approved ? addDays(order.approved, order.holdDays) : '';

export function commission(order) {
  if (order.status === 'rejected' || order.refund >= order.amount) return 0;
  return Math.round((order.amount - order.refund) * order.rate / 100) + order.bonus;
}

export function orderStatus(order) {
  if (order.refund === order.amount) return 'refunded';
  if (order.status === 'approved' && order.refund) return 'partial';
  return order.status;
}

export function batchFor(data, orderId) {
  return data.batches.find(batch => batch.entries.some(entry => entry.orderId === orderId && !entry.adjustmentId));
}

export function earningStatus(data, order) {
  if (orderStatus(order) === 'refunded') return 'refunded';
  if (order.status !== 'approved') return order.status;
  const batch = batchFor(data, order.id);
  if (batch) return batch.paidAt ? 'paid' : 'batched';
  return holdEnd(order) > TODAY ? 'hold' : 'payable';
}

export function selectPartners(data, role, filters) {
  return data.partners.filter(p => role === 'affiliate' ? p.id === PARTNER_ID :
    (!filters.group || p.group === filters.group) &&
    (!filters.partner || p.id === filters.partner),
  );
}

export function stats(data, partnerIds, range, opts = {}) {
  const chosen = new Set(partnerIds);
  const selected = item => chosen.has(item.partner) &&
    (!opts.link || item.link === opts.link) && (!opts.campaign || item.campaign === opts.campaign);
  const events = data.activity.filter(row => selected(row) && includesDate(row.at, range));
  const orders = data.orders.filter(o => selected(o) && includesDate(o.paidAt, range) && o.status !== 'rejected' &&
    !(o.refund >= o.amount && (!o.refundedAt || o.refundedAt <= range.end)));
  const sums = { click: 0, unique: 0, l0: 0, free: 0, plus: orders.length, revenue: 0, com: 0 };
  for (const row of events) {
    for (const metric of ['click', 'unique', 'l0', 'free']) sums[metric] += row[metric];
  }
  for (const order of orders) {
    const version = order.refundedAt && order.refundedAt > range.end ? { ...order, refund: 0 } : order;
    sums.revenue += version.amount - version.refund;
    sums.com += commission(version);
  }
  return sums;
}

export function earnings(data, partnerIds) {
  const chosen = new Set(partnerIds);
  const totals = { pending: 0, hold: 0, payable: 0, batched: 0, paid: 0 };
  for (const order of data.orders.filter(o => chosen.has(o.partner))) {
    const status = earningStatus(data, order);
    if (status === 'pending' || status === 'hold' || status === 'payable') totals[status] += commission(order);
  }
  for (const batch of data.batches) {
    totals[batch.paidAt ? 'paid' : 'batched'] += batch.entries.filter(e => chosen.has(e.partner)).reduce((total, entry) => total + entry.amount, 0);
  }
  for (const adjustment of data.adjustments.filter(a => !a.batch && chosen.has(a.partner))) totals.payable += adjustment.amount;
  return totals;
}

export function record(data, text) {
  data.audit.unshift({ text, at: TODAY });
}

export function newLink(data, fields) {
  const partner = data.partners.find(p => p.id === fields.partner);
  const code = fields.code.trim().toUpperCase();
  if (!partner || partner.status !== 'active') throw new Error('Chọn một đối tác đang hoạt động.');
  if (data.links.some(l => l.code === code)) throw new Error('Mã này đã được sử dụng.');
  const link = { id: `LK-${Date.now()}`, partner: partner.id, channel: fields.channel, code, campaign: fields.campaign ?? '', created: TODAY, active: true, coupon: '' };
  data.links.push(link);
  return link;
}

export function decideOrder(data, order, decision, reason = '', attributedLink = '') {
  if (order.status !== 'pending' || order.refund >= order.amount) throw new Error('Giao dịch đã được xử lý.');
  if (decision === 'approved') {
    if (order.conflict && !attributedLink) throw new Error('Chọn nguồn giới thiệu trước khi xác nhận.');
    if (attributedLink) {
      const link = data.links.find(l => l.id === attributedLink);
      const partner = data.partners.find(p => p.id === link?.partner);
      if (!link || !partner || link.created > order.paidAt) throw new Error('Nguồn giới thiệu chưa có hiệu lực tại ngày thanh toán.');
      const policy = data.policies.find(version => version.id === order.version) ?? policyAt(data, order.paidAt);
      const campaign = data.campaigns.find(c => c.id === link.campaign && c.state !== 'draft' &&
        (!c.publishedAt || c.publishedAt <= order.paidAt) && c.start <= order.paidAt && c.end >= order.paidAt &&
        c.members[partner.id] === 'joined' && c.eligibleProduct === order.product);
      order.link = link.id;
      order.partner = partner.id;
      order.campaign = campaign?.id ?? '';
      order.baseRate = policy[partner.group];
      order.rate = campaign?.kind === 'rate' ? campaign.value : order.baseRate * (campaign?.kind === 'multiplier' ? campaign.value : 1);
      order.bonus = campaign?.kind === 'fixed' ? campaign.value : 0;
      order.version = policy.id;
      order.conflict = false;
    }
    order.approved = TODAY;
  }
  order.status = decision;
  order.reason = reason;
  order.history.push({ at: TODAY, text: decision === 'approved' ? 'Merchant đã xác nhận chuyển đổi.' : 'Merchant đã từ chối chuyển đổi.', reason });
}

export function refundOrder(data, order, amount, reason) {
  if (!Number.isInteger(amount) || amount <= 0 || amount > order.amount - order.refund) throw new Error('Nhập số tiền trong phạm vi giá trị còn lại của đơn.');
  const previous = commission(order);
  order.refund += amount;
  order.refundedAt = TODAY;
  order.reason = reason;
  const difference = commission(order) - previous;
  const batch = batchFor(data, order.id);
  if (batch?.paidAt && difference !== 0) {
    data.adjustments.push({ id: `ADJ-${Date.now()}`, orderId: order.id, partner: order.partner, amount: difference, at: TODAY, reason, batch: '' });
  } else if (batch) {
    batch.entries.find(e => e.orderId === order.id && !e.adjustmentId).amount = commission(order);
  }
  order.history.push({ at: TODAY, text: `Ghi nhận hoàn tiền ${money(amount)}.`, reason });
}

export function eligiblePayoutEntries(data, ids) {
  const chosen = new Set(ids);
  const positive = data.orders.filter(o => chosen.has(o.partner) && earningStatus(data, o) === 'payable' && commission(o) > 0)
    .map(o => ({ orderId: o.id, partner: o.partner, amount: commission(o) }));
  const negative = data.adjustments.filter(a => chosen.has(a.partner) && !a.batch)
    .map(a => ({ orderId: a.orderId, partner: a.partner, amount: a.amount, adjustmentId: a.id }));
  const entries = [...positive, ...negative];
  const eligible = ids.filter(id => entries.filter(e => e.partner === id).reduce((sum, e) => sum + e.amount, 0) >= policyAt(data).threshold);
  return entries.filter(e => eligible.includes(e.partner));
}

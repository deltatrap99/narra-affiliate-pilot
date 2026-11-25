import { GROUPS, TODAY, date, number, money, percent } from './model.js';

export const icon = (name, className = '') => `<span class="symbol ${className}" aria-hidden="true">${name}</span>`;
export const brandMark = '<span class="brand-mark" aria-hidden="true"><img src="assets/narra-n.png" alt="" width="28" height="28"></span>';
export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const fold = value => String(value ?? '').toLocaleLowerCase('vi').replaceAll('đ', 'd').normalize('NFD').replace(/\p{M}/gu, '');
export const matches = (query, ...values) => {
  const term = fold(query).trim();
  return !term || values.some(value => fold(value).includes(term));
};

export const merchantNav = [
  ['overview', 'Tổng quan', 'dashboard'],
  ['campaigns', 'Chiến dịch', 'campaign'],
  ['partners', 'Đối tác', 'group'],
  ['tools', 'Công cụ quảng bá', 'link'],
  ['orders', 'Đơn hàng', 'shopping_bag'],
  ['payouts', 'Hoa hồng & chi trả', 'account_balance_wallet'],
];
export const affiliateNav = [
  ['overview', 'Tổng quan', 'dashboard'],
  ['policy', 'Chính sách & quyền lợi', 'description'],
  ['campaigns', 'Chiến dịch', 'campaign'],
  ['tools', 'Công cụ quảng bá', 'link'],
  ['orders', 'Hiệu quả giới thiệu', 'monitoring'],
  ['payouts', 'Thu nhập & thanh toán', 'account_balance_wallet'],
];

const statusLabels = {
  active: ['Đang hoạt động', 'good'], pending: ['Chờ xác minh', 'warn'], paused: ['Tạm dừng', 'muted'],
  live: ['Đang diễn ra', 'good'], scheduled: ['Sắp diễn ra', 'violet'], ended: ['Đã kết thúc', 'muted'],
  draft: ['Bản nháp', 'muted'], approved: ['Đã xác nhận', 'good'], rejected: ['Từ chối', 'bad'],
  refunded: ['Đã hoàn tiền', 'bad'], partial: ['Hoàn một phần', 'warn'], hold: ['Đang giữ', 'violet'],
  payable: ['Đủ điều kiện chi', 'good'], batched: ['Đã vào kỳ', 'blue'], paid: ['Đã chi trả', 'good'],
  joined: ['Đã tham gia', 'good'], open: ['Đang tiếp nhận', 'good'],
};

export const statusText = status => statusLabels[status]?.[0] ?? status;
export function badge(status, label) {
  const [defaultLabel, tone] = statusLabels[status] ?? [status, 'muted'];
  return `<span class="badge badge-${tone}"><span aria-hidden="true"></span>${esc(label ?? defaultLabel)}</span>`;
}

export const avatar = (person, size = '') => `<span class="avatar ${esc(person?.tone ?? 'violet')} ${size}" aria-hidden="true">${esc(person?.name?.split(/\s+/).slice(0, 2).map(word => word[0]).join('') ?? 'N')}</span>`;
export const groupName = group => GROUPS[group] ?? 'Tất cả nhóm';
export const groupShort = group => ({ DSGD: 'ĐSGD', DSSV: 'ĐSSV' }[group] ?? 'Tất cả nhóm');
export const formatRange = range => `${date(range.start, false)} - ${date(range.end)}`;
export const action = (label, name, { symbol = '', type = 'secondary', attributes = '' } = {}) =>
  `<button class="btn btn-${type}" type="button" data-action="${name}" ${attributes}>${symbol ? icon(symbol) : ''}${esc(label)}</button>`;
export const route = (role, page, sub = '') => `#/${role}/${page}${sub ? '/' + sub : ''}`;
export const textLink = (role, page, label, sub = '') => `<a class="text-link" href="${route(role, page, sub)}">${esc(label)}</a>`;

export function optionList(values, current) {
  return values.map(([value, label]) => `<option value="${esc(value)}" ${String(value) === String(current) ? 'selected' : ''}>${esc(label)}</option>`).join('');
}

export const select = (field, label, values, current) => `<label class="control select-control"><span class="sr-only">${esc(label)}</span><select data-filter="${field}">${optionList(values, current)}</select>${icon('expand_more')}</label>`;
export const search = (placeholder, value = '') => `<label class="control search-control">${icon('search')}<span class="sr-only">${esc(placeholder)}</span><input data-filter="query" type="search" placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off"></label>`;

export function empty(label, body = 'Thử đổi bộ lọc hoặc chọn một khoảng thời gian khác.', symbol = 'folder_open') {
  return `<div class="empty"><span class="empty-icon">${icon(symbol)}</span><strong>${esc(label)}</strong>${body ? `<p>${esc(body)}</p>` : ''}</div>`;
}

export function table(headers, rows, emptyTitle = 'Chưa có dữ liệu', emptyBody, requestedPage = null) {
  if (!rows.length) return empty(emptyTitle, emptyBody);
  const pageSize = 12;
  const pages = requestedPage ? Math.ceil(rows.length / pageSize) : 1;
  const page = Math.max(1, Math.min(pages, requestedPage ?? 1));
  const start = (page - 1) * pageSize;
  const visible = requestedPage ? rows.slice(start, start + pageSize) : rows;
  const arrow = (step, label, glyph, disabled) =>
    `<button class="icon-button" type="button" data-action="table-page" data-value="${page + step}" aria-label="${label}" title="${label}" ${disabled ? 'disabled' : ''}>${icon(glyph)}</button>`;
  const pager = pages > 1 ? `<nav class="table-pager" aria-label="Phân trang">
    <span class="page-counter" tabindex="-1">${number(start + 1)}-${number(start + visible.length)} / ${number(rows.length)} kết quả</span>
    <div>${arrow(-1, 'Trang trước', 'chevron_left', page === 1)}${arrow(1, 'Trang sau', 'chevron_right', page === pages)}</div>
  </nav>` : '';
  return `<div class="table-scroll" role="region" aria-label="Bảng dữ liệu" tabindex="0"><table><thead><tr>${headers.map(title => `<th scope="col">${esc(title)}</th>`).join('')}</tr></thead><tbody>${visible.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${pager}`;
}

export const recordLink = (type, id, label = id) => `<button type="button" class="record-link" data-action="detail" data-type="${type}" data-id="${esc(id)}">${esc(label)}</button>`;

export const personCell = (person, link = true) => person ? `<div class="person-cell">${avatar(person)}<span>${link ? recordLink('partner', person.id, person.name) : `<strong>${esc(person.name)}</strong>`}<small>${esc(groupShort(person.group))} · ${esc(person.id)}</small></span></div>` : 'Chưa có';

export const cardTitle = (title, caption = '', extra = '') => `<div class="card-head"><div><h2>${esc(title)}</h2>${caption ? `<p>${esc(caption)}</p>` : ''}</div>${extra}</div>`;

export const pageTitle = (title, text, extra = '') => `<header class="page-title"><div><h1>${esc(title)}</h1><p>${esc(text)}</p></div>${extra ? `<div class="page-actions">${extra}</div>` : ''}</header>`;

export const tabs = (items, current) => `<nav class="tabs" aria-label="Nội dung trang">${items.map(([value, label]) => `<button type="button" class="tab ${value === current ? 'selected' : ''}" data-action="tab" data-value="${esc(value)}" aria-pressed="${current === value}">${esc(label)}</button>`).join('')}</nav>`;
export const note = (text, symbol = 'info') => `<p class="note">${icon(symbol)}<span>${esc(text)}</span></p>`;

export const statIcon = (name, tone) => `<span class="stat-icon tone-${tone}">${icon(name)}</span>`;

export function metricCards(values) {
  return `<div class="metrics">${values.map(({ label, value, symbol, tone = 'violet', previous, raw, detail, metric, foot }) => {
    const difference = previous === undefined ? null : previous ? ((raw - previous) / previous) * 100 : raw ? Infinity : 0;
    const delta = difference === null ? '' : `<div class="metric-foot"><span class="delta ${difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat'}">${
      Number.isFinite(difference) && difference !== 0 ? icon(difference > 0 ? 'arrow_upward' : 'arrow_downward') + percent(Math.abs(difference)) : difference === Infinity ? 'Mới trong kỳ' : '0%'
    }</span><span>so với kỳ trước</span></div>`;
    const body = `<div class="metric-top">${statIcon(symbol, tone)}<span>${esc(label)}</span>${detail ? icon('chevron_right', 'metric-chevron') : ''}</div><strong class="metric-value">${esc(value)}</strong>${delta || (foot ? `<small class="metric-note">${esc(foot)}</small>` : '')}`;
    return detail
      ? `<button type="button" class="metric card" data-action="${detail}" data-value="${esc(metric)}">${body}</button>`
      : `<div class="metric card">${body}</div>`;
  }).join('')}</div>`;
}

export function filterBar(context) {
  const { role, range, filters, data } = context;
  const merchant = role === 'merchant';
  const available = data.partners.filter(p => !filters.group || p.group === filters.group);
  const dateButton = `<button class="control date-control" type="button" data-action="date-filter" aria-haspopup="dialog">${icon('calendar_today')}<span>${formatRange(range)}</span>${icon('expand_more')}</button>`;
  return `<div class="filter-bar"><div class="filter-controls">${dateButton}
    ${merchant ? select('group', 'Nhóm đối tác', [['', 'Tất cả nhóm'], ...Object.entries(GROUPS)], filters.group) : ''}
    ${merchant ? select('partner', 'Đối tác', [['', 'Tất cả đối tác'], ...available.map(p => [p.id, p.name])], filters.partner) : ''}
  </div><span class="filter-meta">Giờ Việt Nam (GMT+7)</span></div>`;
}

export const firstName = name => String(name || 'Đại sứ').split(/\s+/).slice(-2).join(' ');
export const sum = entries => entries.reduce((total, e) => total + e.amount, 0);
export const rate = (part, total) => total ? 100 * part / total : 0;
export const count = number;
export const cash = money;
export const today = date(TODAY);

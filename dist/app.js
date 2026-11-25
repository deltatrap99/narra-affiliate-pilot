import {
  TODAY, GROUPS, PARTNER_ID, date, number, money, percent, initialRange, includesDate, numDays,
  readState, saveState, selectPartners, stats, policyAt, campaignStatus, inAudience, commission,
  orderStatus, eligiblePayoutEntries, decideOrder, refundOrder, newLink, record,
} from './model.js';
import { icon, brandMark, esc, avatar, groupName, route, action, merchantNav, affiliateNav, statusText, sum } from './ui.js';
import {
  overview, campaigns, partners, toolsPage, orders, payouts, policyPage, systemPage, supportPage,
  campaignList, partnerList, linkList, orderTable, listOrders, payoutList, buckets,
} from './views.js';
import {
  datePanel, campaignForm, partnerForm, orderForm, batchForm, policyForm, linkForm, metricPanel,
  detailPanel, profilePanel, supportForm, choosePreset,
} from './panels.js';
import { mountChart } from './chart.js';
import { appearanceMenu, commandPanel, commandResults } from './workspace-ui.js';

const shell = document.querySelector('#shell');
const rail = document.querySelector('#rail');
const workspace = document.querySelector('#workspace');
const topbar = document.querySelector('#topbar');
const main = document.querySelector('#main');
const dialog = document.querySelector('#dialog');
const scrim = document.querySelector('#scrim');
const toasts = document.querySelector('#toasts');
const mobile = window.matchMedia('(max-width: 760px)');
const preferencesKey = 'narra-affiliate-preferences-v1';
const defaultWidth = 248;
const minimumWidth = 218;
const maximumWidth = 352;

function readPreferences() {
  try { return JSON.parse(localStorage.getItem(preferencesKey)) ?? {}; }
  catch { return {}; }
}

const preferences = readPreferences();
let data = readState();
let role = 'merchant';
let page = 'overview';
let range = preferences.range?.start && preferences.range?.end ? preferences.range : initialRange;
let filters = { group: '', partner: '' };
let view = { tab: 'list', query: '', status: '', campaign: '', link: '' };
let grain = preferences.grain ?? 'day';
let sidebarWidth = Math.max(minimumWidth, Math.min(maximumWidth, Number(preferences.width) || defaultWidth));
let collapsed = preferences.collapsed === true;
let theme = preferences.theme === 'dark' ? 'dark' : 'light';
let layout = preferences.layout === 'horizontal' ? 'horizontal' : 'vertical';
let mobileOpen = false;
let drawerTrigger = null;
let activePopup = '';
let chartDisposer = () => {};
let panels = [];
let previousFocus = null;
let routeSignature = '';
let resizeFrame = null;
let drag = null;

const pageViews = {
  overview, campaigns, partners, tools: toolsPage, orders, payouts, policy: policyPage, system: systemPage, support: supportPage,
};
const resultViews = {
  campaigns: campaignList, partners: partnerList, tools: linkList,
  orders: ctx => orderTable(ctx, listOrders(ctx), true), payouts: payoutList,
};

function persistPreferences() {
  try {
    localStorage.setItem(preferencesKey, JSON.stringify({ width: sidebarWidth, collapsed, range, grain, theme, layout }));
  } catch {}
}

function ctx() {
  const partners = selectPartners(data, role, filters);
  return { data, role, page, range, filters, view, grain, partners, ids: partners.map(p => p.id) };
}

function workspaceName(target = role) {
  return target === 'merchant' ? 'Merchant Center' : 'Affiliate User Center';
}

function navigation() {
  return role === 'merchant' ? merchantNav : affiliateNav;
}

function allNavigation() {
  return [...navigation(), ...(role === 'merchant' ? [['system', 'Quản trị hệ thống', 'settings']] : []),
    ['support', 'Hỗ trợ', 'support_agent']];
}

function titleForPage() {
  return navigation().find(([key]) => key === page)?.[1] ?? (page === 'system' ? 'Quản trị hệ thống' : 'Hỗ trợ');
}

function navLink([key, label, symbol]) {
  return `<a class="rail-link" href="${route(role, key)}" title="${esc(label)}" ${key === page ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${esc(label)}</span></a>`;
}

function buttonIcon(name, symbol, label, extra = '') {
  return `<button type="button" class="icon-button ${extra}" data-action="${name}" aria-label="${esc(label)}" title="${esc(label)}">${icon(symbol)}</button>`;
}

function workspacePicker(id) {
  const merchant = role === 'merchant';
  return `<button class="workspace-switch" type="button" data-action="popup" data-value="${id}" aria-controls="${id}" aria-expanded="false" title="Chuyển cổng Narra">
    <span class="workspace-icon">${icon(merchant ? 'storefront' : 'group')}</span>
    <span class="workspace-copy"><strong>${workspaceName()}</strong><small>${merchant ? 'Quản trị chương trình' : 'Không gian đại sứ'}</small></span>${icon('expand_more')}
  </button>
  <div class="popover workspace-popup" id="${id}" hidden>
    <div class="popover-title">Chuyển cổng làm việc</div>
    ${[['merchant', 'storefront', 'Quản trị chương trình'], ['affiliate', 'group', 'Dành cho Đại sứ']].map(([key, symbol, info]) =>
      `<a class="${role === key ? 'active-menu' : ''}" href="${route(key, 'overview')}">${icon(symbol)}<span><strong>${workspaceName(key)}</strong><small>${info}</small></span>${role === key ? icon('check') : ''}</a>`).join('')}
  </div>`;
}

function renderRail() {
  const suite = role === 'merchant';
  rail.innerHTML = `<div class="rail-content">
    <div class="rail-top">
      <a class="brand" href="${route(role, 'overview')}" aria-label="Narra Affiliate, Tổng quan">${brandMark}<span class="brand-name">Narra Affiliate</span></a>
      ${buttonIcon('toggle-sidebar', 'left_panel_close', 'Thu gọn thanh điều hướng', 'rail-toggle')}
      ${buttonIcon('close-sidebar', 'close', 'Đóng thanh điều hướng', 'mobile-close')}
    </div>
    <div class="rail-switch">${workspacePicker("workspaces")}</div>
    <p class="rail-label">${suite ? 'Chương trình' : 'Không gian của bạn'}</p>
    <nav class="rail-nav" aria-label="Nghiệp vụ Narra">${navigation().map(navLink).join('')}</nav>
    ${suite ? `<div class="rail-divider"></div><nav class="rail-nav" aria-label="Quản trị">${navLink(['system', 'Quản trị hệ thống', 'settings'])}</nav>` : ''}
    <div class="rail-bottom">
      ${navLink(['support', 'Hỗ trợ', 'support_agent'])}
    </div>
  </div>
  <div class="rail-resize" id="rail-size" role="separator" aria-label="Chiều rộng thanh điều hướng" aria-controls="rail" aria-orientation="vertical" aria-valuemin="${minimumWidth}" aria-valuemax="${maximumWidth}" aria-valuenow="${sidebarWidth}" tabindex="0" title="Kéo để đổi chiều rộng"></div>`;
}

function notificationItems() {
  if (role === 'merchant') {
    const orderCount = data.orders.filter(o => orderStatus(o) === 'pending').length;
    const partnerCount = data.partners.filter(p => p.status === 'pending').length;
    const batchCount = data.batches.filter(b => !b.paidAt).length;
    return [
      ...(orderCount ? [['orders', 'pending', 'shopping_bag', 'Đơn đang chờ xác minh', `${number(orderCount)} đơn hàng`]] : []),
      ...(partnerCount ? [['partners', 'pending', 'group', 'Hồ sơ đang chờ duyệt', `${number(partnerCount)} hồ sơ`]] : []),
      ...(batchCount ? [['payouts', 'batches', 'payments', 'Kỳ đối soát đang mở', `${number(batchCount)} kỳ đối soát`]] : []),
    ];
  }
  const person = data.partners.find(p => p.id === PARTNER_ID);
  return data.campaigns.filter(c => ['live', 'scheduled'].includes(campaignStatus(c)) && inAudience(c, person))
    .slice(0, 4).map(c => ['campaigns', '', 'campaign', c.name, statusText(campaignStatus(c))]);
}

function renderTopbar() {
  const merchant = role === 'merchant';
  const person = merchant ? { name: 'Narra Admin', tone: 'violet' } : { name: data.profile.name, tone: 'violet' };
  const items = notificationItems();
  const name = titleForPage();
  const shortcut = /Mac|iPhone|iPad/.test(window.navigator.platform) ? '⌘ K' : 'Ctrl K';
  topbar.innerHTML = `<div class="topbar-row">
    <div class="breadcrumb" aria-label="Vị trí hiện tại">
      ${buttonIcon('open-sidebar', 'menu', 'Mở thanh điều hướng', 'mobile-open')}
      ${buttonIcon('toggle-sidebar', 'left_panel_open', 'Mở rộng thanh điều hướng', 'desktop-open')}
      <a class="horizontal-brand" href="${route(role, 'overview')}" aria-label="Narra Affiliate, Tổng quan">${brandMark}</a>
      <div class="horizontal-switch">${workspacePicker('horizontal-workspaces')}</div>
      <a class="breadcrumb-home" href="${route(role, 'overview')}">${workspaceName()}</a>${icon('chevron_right', 'crumb-chevron')}<strong>${esc(name)}</strong>
    </div>
    <div class="top-actions">
      <button type="button" class="quick-search" data-action="command-search" aria-label="Tìm trong Narra" aria-haspopup="dialog">
        ${icon('search')}<span>Tìm trong Narra</span><kbd>${shortcut}</kbd>
      </button>
      <button type="button" class="icon-button" data-action="popup" data-value="appearance" aria-controls="appearance" aria-expanded="false" aria-label="Giao diện" title="Giao diện">${icon('tune')}</button>
      <button type="button" class="icon-button" data-action="popup" data-value="notifications" aria-expanded="false" aria-controls="notifications" aria-label="Thông báo" title="Thông báo">${icon('notifications')}${items.length ? '<span class="notification-dot"></span>' : ''}</button>
      <div class="top-split"></div>
      <button type="button" class="account-button" data-action="popup" data-value="account" aria-expanded="false" aria-controls="account" aria-label="Tài khoản ${esc(person.name)}">
        ${avatar(person)}<span class="account-copy"><strong>${esc(person.name)}</strong><small>${merchant ? 'Quản trị viên' : 'Đại sứ Narra'}</small></span>${icon('expand_more')}
      </button>
      ${appearanceMenu(theme, layout)}
      <div class="popover" id="account" hidden>
        <button type="button" data-action="profile">${icon('person')} Hồ sơ tài khoản</button>
        <a href="${route(role, 'support')}">${icon('support_agent')} Hỗ trợ</a>
        <a href="${route(merchant ? 'affiliate' : 'merchant', 'overview')}">${icon('workspaces')}${merchant ? 'Sang cổng Đại sứ' : 'Sang Merchant Center'}</a>
      </div>
      <div class="popover notification-menu" id="notifications" hidden>
        <div class="popover-title">Thông báo</div>
        ${items.length ? items.map(([key, tab, symbol, text, caption]) => `<a href="${route(role, key, tab)}"><span class="command-icon">${icon(symbol)}</span><span><strong>${esc(text)}</strong><small>${esc(caption)}</small></span></a>`).join('') : '<small class="popover-title">Chưa có thông báo mới.</small>'}
      </div>
    </div>
  </div>
  <nav class="horizontal-nav" aria-label="Nghiệp vụ Narra">${allNavigation().map(navLink).join('')}</nav>`;
}

function renderMain() {
  chartDisposer();
  const current = ctx();
  main.innerHTML = pageViews[page](current);
  chartDisposer = page === 'overview' ? mountChart(buckets(current)) : () => {};
}

function render() {
  const current = document.activeElement;
  const restore = current?.dataset.action === 'tab' ? current.dataset.value : null;
  closePopup();
  renderRail();
  renderTopbar();
  renderMain();
  renderSidebarState();
  document.title = `${titleForPage()} · Narra Affiliate`;
  if (restore && !dialog.open) main.querySelector(`[data-action="tab"][data-value="${CSS.escape(restore)}"]`)?.focus({ preventScroll: true });
}

function renderResults() {
  const result = document.querySelector('#results');
  if (result && resultViews[page]) result.innerHTML = resultViews[page](ctx());
}

function parseRoute() {
  const [target, viewKey, sub] = window.location.hash.replace(/^#\/?/, '').split('/');
  role = target === 'affiliate' ? 'affiliate' : 'merchant';
  const valid = navigation().some(([key]) => key === viewKey) || viewKey === 'support' || (role === 'merchant' && viewKey === 'system');
  page = valid ? viewKey : 'overview';
  view = { tab: 'list', query: '', status: '', campaign: '', link: '' };
  if (sub === 'pending' && ['orders', 'partners'].includes(page)) view.status = 'pending';
  if (['batches', 'adjustments'].includes(sub) && page === 'payouts') view.tab = sub;
  if (sub === 'program' && page === 'campaigns' && role === 'merchant') view.tab = sub;
}

function syncRoute() {
  if (referralCode) return;
  if (window.location.hash === '#main') {
    main.focus();
    return;
  }
  if (window.location.hash === routeSignature) return;
  routeSignature = window.location.hash;
  closePopup();
  closeDialog(false);
  setDrawer(false, false);
  parseRoute();
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  main.focus({ preventScroll: true });
}

function renderSidebarState() {
  const horizontal = layout === 'horizontal' && !mobile.matches;
  shell.classList.toggle('is-horizontal', horizontal);
  shell.classList.toggle('is-collapsed', collapsed && !horizontal && !mobile.matches);
  shell.classList.toggle('is-mobile-open', mobileOpen && mobile.matches);
  shell.style.setProperty('--rail-width', sidebarWidth + 'px');
  const separator = document.querySelector('#rail-size');
  separator?.setAttribute('aria-valuenow', sidebarWidth);
  separator?.setAttribute('aria-valuetext', sidebarWidth + ' pixel');
  topbar.querySelector('.mobile-open')?.setAttribute('aria-expanded', String(mobileOpen));
  rail.inert = horizontal || (mobile.matches && !mobileOpen);
  workspace.inert = mobile.matches && mobileOpen;
  document.body.classList.toggle('nav-open', mobile.matches && mobileOpen);
  scrim.hidden = !(mobile.matches && mobileOpen);
}

function setAppearance(setting, next) {
  if (setting === 'theme' && ['light', 'dark'].includes(next)) {
    theme = next;
    document.documentElement.dataset.theme = theme;
    window.dispatchEvent(new window.Event('narra:theme'));
  } else if (setting === 'layout' && ['vertical', 'horizontal'].includes(next)) {
    layout = next;
    renderSidebarState();
  } else {
    return;
  }
  topbar.querySelectorAll('.appearance-option').forEach(option => {
    const selected = option.dataset.type === 'theme' ? theme : layout;
    option.setAttribute('aria-pressed', String(option.dataset.value === selected));
  });
  persistPreferences();
}

function setDrawer(open, restore = true) {
  if (open && !mobile.matches) return;
  if (open === mobileOpen) return;
  if (open) drawerTrigger = topbar.querySelector('.mobile-open') ?? document.activeElement;
  mobileOpen = open;
  closePopup();
  renderSidebarState();
  if (open) rail.querySelector('.mobile-close')?.focus();
  else if (restore && drawerTrigger?.isConnected) drawerTrigger.focus();
}

function toggleSidebar() {
  if (mobile.matches) {
    setDrawer(!mobileOpen);
    return;
  }
  collapsed = !collapsed;
  closePopup();
  shell.classList.add('animate-rail');
  renderSidebarState();
  setTimeout(() => shell.classList.remove('animate-rail'), 215);
  const next = collapsed ? topbar.querySelector('.desktop-open') : rail.querySelector('.rail-toggle');
  next?.focus({ preventScroll: true });
  persistPreferences();
}

function setWidth(width) {
  sidebarWidth = Math.max(minimumWidth, Math.min(maximumWidth, Math.round(width)));
  renderSidebarState();
}

rail.addEventListener('pointerdown', event => {
  const handle = event.target.closest('.rail-resize');
  if (!handle || mobile.matches || collapsed || event.button !== 0) return;
  event.preventDefault();
  drag = { x: event.clientX, width: sidebarWidth, pointerId: event.pointerId, next: sidebarWidth };
  handle.setPointerCapture(event.pointerId);
  closePopup();
  shell.classList.remove('animate-rail');
  document.body.classList.add('resizing');
});

rail.addEventListener('pointermove', event => {
  if (event.pointerId !== drag?.pointerId) return;
  drag.next = drag.width + event.clientX - drag.x;
  if (resizeFrame === null) resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null;
    if (drag) setWidth(drag.next);
  });
});

function finishResize(event) {
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
  resizeFrame = null;
  setWidth(drag.next);
  drag = null;
  document.body.classList.remove('resizing');
  persistPreferences();
}
rail.addEventListener('pointerup', finishResize);
rail.addEventListener('pointercancel', finishResize);
rail.addEventListener('lostpointercapture', finishResize);
rail.addEventListener('dblclick', event => {
  if (!event.target.closest('.rail-resize')) return;
  setWidth(defaultWidth);
  persistPreferences();
});
rail.addEventListener('keydown', event => {
  if (event.target.id !== 'rail-size' || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  setWidth(event.key === 'Home' ? minimumWidth : event.key === 'End' ? maximumWidth : sidebarWidth + (event.key === 'ArrowLeft' ? -12 : 12));
  persistPreferences();
});

function closePopup(restore = false) {
  if (!activePopup) return;
  const popup = document.getElementById(activePopup);
  const control = document.querySelector(`[aria-controls="${activePopup}"]`);
  if (popup) popup.hidden = true;
  control?.setAttribute('aria-expanded', 'false');
  if (restore) control?.focus();
  activePopup = '';
}

function togglePopup(name, trigger) {
  const isOpen = activePopup === name;
  closePopup();
  if (isOpen) return;
  const popup = document.getElementById(name);
  if (!popup) return;
  popup.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  activePopup = name;
  (popup.querySelector('.active-menu, [aria-pressed="true"]') ?? popup.querySelector('button, a[href]'))?.focus({ preventScroll: true });
}

function toast(message, error = false) {
  const item = document.createElement('div');
  item.className = 'toast' + (error ? ' error' : '');
  item.innerHTML = icon(error ? 'info' : 'check_circle') + `<span>${esc(message)}</span>`;
  toasts.replaceChildren(item);
  setTimeout(() => item.remove(), 3300);
}

function drawDialog(panel) {
  dialog.className = [panel.size, panel.presentation].filter(Boolean).join(' ');
  const body = `<header class="dialog-heading"><div><h2 id="dialog-title">${esc(panel.title)}</h2>${panel.subtitle ? `<p>${esc(panel.subtitle)}</p>` : ''}</div>
  ${buttonIcon('close-dialog', 'close', 'Đóng cửa sổ', 'dialog-close')}</header>
  <div class="dialog-body">${panel.body}<p class="form-error" role="alert" hidden></p></div>
  ${panel.footer || panels.length > 1 ? `<footer class="dialog-footer">${panels.length > 1 ? action('Quay lại', 'back-dialog', { symbol: 'chevron_left' }) : ''}${panel.footer ?? ''}</footer>` : ''}`;
  dialog.innerHTML = panel.form ? `<form data-form="${panel.form}" data-id="${esc(panel.id ?? '')}">${body}</form>` : body;
  dialog.scrollTop = 0;
  if (panel.query) {
    dialog.querySelector('[data-command-input]').value = panel.query;
    dialog.querySelector('#command-results').innerHTML = commandResults(ctx(), allNavigation(), panel.query);
  }
}

function showPanel(panel, nested = false) {
  if (!panel) {
    toast('Mục này hiện không có trong phạm vi đang xem.', true);
    return;
  }
  closePopup();
  if (!dialog.open) previousFocus = document.activeElement;
  if (!nested || !dialog.open) panels = [panel];
  else panels.push(panel);
  drawDialog(panel);
  if (!dialog.open) dialog.showModal();
  const initial = dialog.querySelector('input:not([type="hidden"]), select, textarea') ?? dialog.querySelector('.dialog-close');
  initial?.focus({ preventScroll: true });
}

function closeDialog(restore = true) {
  if (!dialog.open) return;
  dialog.close();
  panels = [];
  if (restore) {
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    else main.focus({ preventScroll: true });
  }
  previousFocus = null;
}

function goBackDialog() {
  if (panels.length < 2) { closeDialog(); return; }
  panels.pop();
  drawDialog(panels.at(-1));
  (dialog.querySelector('[data-command-input]') ?? dialog.querySelector('.dialog-close'))?.focus();
}

dialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeDialog();
});
dialog.addEventListener('click', event => {
  if (event.target === dialog) closeDialog();
});

function merchantOnly() {
  if (role !== 'merchant') throw new Error('Thao tác này dành cho Merchant Center.');
}

function findData(list, id) {
  const chosen = data[list].find(row => row.id === id);
  if (!chosen) throw new Error('Không tìm thấy dữ liệu tương ứng.');
  return chosen;
}

function update(message, summary, next = null) {
  if (summary) record(data, summary);
  saveState(data);
  closeDialog(false);
  render();
  if (next) showPanel(next());
  else main.focus({ preventScroll: true });
  toast(message);
}

function handleCampaign(trigger) {
  const id = trigger.dataset.id;
  const campaign = findData('campaigns', id);
  const person = findData('partners', PARTNER_ID);
  const name = trigger.dataset.action;
  if (name === 'join-campaign') {
    if (role !== 'affiliate' || !['live', 'scheduled'].includes(campaignStatus(campaign)) || person.status !== 'active' ||
      !policyAt(data).enabled || !inAudience(campaign, person) || campaign.members[person.id]) {
      throw new Error('Chưa thể đăng ký chiến dịch này.');
    }
    const pending = campaign.mode === 'approval';
    campaign.members[person.id] = pending ? 'pending' : 'joined';
    update(pending ? 'Đã gửi đăng ký để Merchant xem xét.' : 'Bạn đã tham gia chiến dịch.', `${person.name} đăng ký ${campaign.name}.`,
      () => detailPanel(ctx(), 'campaign', id));
    return;
  }
  merchantOnly();
  if (name === 'approve-enrollment') {
    const affiliate = findData('partners', trigger.dataset.partner);
    if (campaign.members[affiliate.id] !== 'pending' || affiliate.status !== 'active' || !inAudience(campaign, affiliate)) {
      throw new Error('Hồ sơ này chưa đủ điều kiện tham gia.');
    }
    campaign.members[affiliate.id] = 'joined';
    update('Đã duyệt đăng ký.', `${affiliate.name} được duyệt tham gia ${campaign.name}.`, () => detailPanel(ctx(), 'campaign', id));
    return;
  }
  if (name === 'pause-campaign') {
    campaign.state = 'paused';
    update('Đã tạm dừng chiến dịch.', `Tạm dừng ${campaign.name}.`, () => detailPanel(ctx(), 'campaign', id));
    return;
  }
  if (campaign.end < TODAY) throw new Error('Cập nhật thời gian kết thúc trước khi công bố lại.');
  campaign.state = 'published';
  campaign.publishedAt ??= TODAY;
  if (campaign.mode === 'auto') {
    for (const partner of data.partners.filter(p => p.status === 'active' && inAudience(campaign, p))) campaign.members[partner.id] = 'joined';
  }
  update('Đã công bố chiến dịch cho nhóm đủ điều kiện.', `Công bố ${campaign.name}.`, () => detailPanel(ctx(), 'campaign', id));
}

function csvCell(value) {
  const text = String(value ?? '');
  const safe = typeof value === 'string' && /^[=+@-]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

function downloadCSV(name, headers, rows) {
  const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name + '.csv' });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Đã tạo tệp CSV.');
}

function exportData(type, id) {
  const current = ctx();
  if (type === 'overview') {
    downloadCSV(`narra-tong-quan-${range.end}`,
      ['Ngày', 'Lượt nhấp', 'L0 hợp lệ', 'Kích hoạt Free', 'Đơn Plus', 'Doanh thu (VND)', 'Hoa hồng (VND)'],
      buckets({ ...current, grain: 'day' }).map(point => [point.span, point.click, point.l0, point.free, point.plus, point.revenue, point.com]));
    return;
  }
  if (type === 'orders' || type === 'campaign') {
    const rows = type === 'campaign' ? listOrders(current, { campaign: id }) : listOrders(current);
    downloadCSV(type === 'campaign' ? `narra-${id}` : `narra-don-hang-${range.end}`,
      ['Mã đơn', ...(role === 'merchant' ? ['Đối tác'] : []), 'Ngày thanh toán (GMT+7)', 'Gói', 'Mã nguồn', 'Doanh thu sau hoàn (VND)', 'Hoa hồng (VND)', 'Trạng thái'],
      rows.map(o => [o.id, ...(role === 'merchant' ? [findData('partners', o.partner).name] : []), o.paidAt, o.product,
        data.links.find(l => l.id === o.link)?.code, o.amount - o.refund, commission(o), statusText(orderStatus(o))]));
    return;
  }
  const batches = type === 'batch' ? [findData('batches', id)] :
    data.batches.filter(b => includesDate(b.paidAt || b.created, current.range));
  const picked = batches.flatMap(b => b.entries.filter(e => current.ids.includes(e.partner)).map(e =>
    [b.id, b.name, b.created, b.paidAt, b.ref, e.orderId, ...(role === 'merchant' ? [findData('partners', e.partner).name] : []),
      e.adjustmentId ? 'Điều chỉnh' : 'Hoa hồng', e.amount, b.paidAt ? 'Đã chi trả' : 'Đã vào kỳ']));
  downloadCSV(type === 'batch' ? `narra-${id}` : `narra-doi-soat-${range.end}`,
    ['Mã kỳ', 'Kỳ đối soát', 'Ngày lập', 'Ngày chi', 'Mã tham chiếu', 'Mã đơn', ...(role === 'merchant' ? ['Đối tác'] : []), 'Loại khoản', 'Số tiền (VND)', 'Trạng thái'], picked);
}

async function copy(value) {
  try {
    await navigator.clipboard.writeText(value);
    toast('Đã sao chép vào bộ nhớ tạm.');
  } catch {
    const input = Object.assign(document.createElement('textarea'), { value, className: 'sr-only' });
    (dialog.open ? dialog : document.body).append(input);
    const focus = document.activeElement;
    input.select();
    const success = document.execCommand('copy');
    input.remove();
    focus?.focus();
    toast(success ? 'Đã sao chép vào bộ nhớ tạm.' : 'Hãy mở chi tiết để sao chép đường dẫn.', !success);
  }
}

function applyDatePreset(target, preset) {
  const form = target.closest('form');
  const chosen = choosePreset(preset);
  if (!form || !chosen) return;
  form.elements.start.value = chosen.start;
  form.elements.end.value = chosen.end;
  form.elements.preset.value = preset;
  form.querySelectorAll('[data-action="preset"]').forEach(button => button.setAttribute('aria-pressed', String(button === target)));
}

function viewTab(tab) {
  view = { tab, query: '', status: '', campaign: '', link: '' };
  render();
}

const simpleActions = {
  'open-sidebar': () => setDrawer(true),
  'close-sidebar': () => setDrawer(false),
  'toggle-sidebar': toggleSidebar,
  'close-dialog': () => closeDialog(),
  'back-dialog': goBackDialog,
  'date-filter': () => showPanel(datePanel(ctx())),
  'command-search': () => showPanel(commandPanel(ctx(), allNavigation())),
  profile: () => showPanel(profilePanel(ctx())),
};

document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-action]');
  if (activePopup && !event.target.closest('.popover') && trigger?.dataset.action !== 'popup') closePopup();
  const anchor = event.target.closest('a[href^="#/"]');
  if (anchor && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
    closePopup();
    if (dialog.open) closeDialog(anchor.hash === window.location.hash);
    if (anchor.hash === window.location.hash) setDrawer(false);
  }
  if (!trigger) return;
  const { action: name, value, id, type } = trigger.dataset;
  try {
    if (simpleActions[name]) { simpleActions[name](); return; }
    const current = ctx();
    switch (name) {
      case 'popup': togglePopup(value, trigger); break;
      case 'appearance': setAppearance(type, value); break;
      case 'table-page':
        view.tablePage = Number(value);
        renderResults();
        document.querySelector('#results .page-counter')?.focus({ preventScroll: true });
        break;
      case 'tab': viewTab(value); break;
      case 'preset': applyDatePreset(trigger, value); break;
      case 'grain':
        grain = value;
        persistPreferences();
        renderMain();
        main.querySelector(`[data-action="grain"][data-value="${CSS.escape(value)}"]`)?.focus({ preventScroll: true });
        break;
      case 'metric': showPanel(metricPanel(current, value)); break;
      case 'detail': showPanel(detailPanel(current, type, id), true); break;
      case 'new-campaign': merchantOnly(); showPanel(campaignForm(current)); break;
      case 'edit-campaign': merchantOnly(); showPanel(campaignForm(current, findData('campaigns', id)), true); break;
      case 'new-policy': merchantOnly(); showPanel(policyForm(current)); break;
      case 'confirm-policy':
        data.profile.confirmedPolicy = policyAt(data).id;
        update('Đã lưu xác nhận đọc chính sách.');
        break;
      case 'publish-campaign': case 'pause-campaign': case 'approve-enrollment': case 'join-campaign':
        handleCampaign(trigger); break;
      case 'approve-partner': merchantOnly(); showPanel(partnerForm(current, id), true); break;
      case 'reject-partner': case 'pause-partner': {
        merchantOnly();
        const p = findData('partners', id);
        const previous = p.status;
        const rejected = name === 'reject-partner';
        if (previous !== (rejected ? 'pending' : 'active')) throw new Error('Trạng thái của hồ sơ đã thay đổi.');
        p.status = rejected ? 'rejected' : 'paused';
        update(rejected ? 'Đã từ chối hồ sơ.' : 'Đã tạm ngưng đối tác.', `${rejected ? 'Từ chối' : 'Tạm ngưng'} đối tác ${p.name}.`,
          () => detailPanel(ctx(), 'partner', id));
        break;
      }
      case 'new-link': showPanel(linkForm(current, id), true); break;
      case 'copy': void copy(value); break;
      case 'decision-approve': showPanel(orderForm(current, id, 'approve'), true); break;
      case 'decision-reject': showPanel(orderForm(current, id, 'reject'), true); break;
      case 'refund-order': showPanel(orderForm(current, id, 'refund'), true); break;
      case 'new-batch': showPanel(batchForm(current)); break;
      case 'pay-batch': showPanel(batchForm(current, id), true); break;
      case 'export': exportData(type, id); break;
      case 'earning-filter':
        view = { tab: 'list', query: '', status: value, campaign: '', link: '' };
        render();
        document.querySelector('#results')?.scrollIntoView({ block: 'nearest' });
        break;
      case 'new-ticket': showPanel(supportForm(id), true); break;
      case 'simulate-lead': simulate('lead'); break;
      case 'simulate-plus': simulate('plus'); break;
    }
  } catch (error) { toast(error.message, true); }
});

document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !referralCode && !mobileOpen) {
    if (dialog.open && !dialog.classList.contains('command-dialog')) return;
    event.preventDefault();
    if (dialog.open) dialog.querySelector('[data-command-input]')?.focus();
    else simpleActions['command-search']();
    return;
  }
  if (event.key === 'Escape' && !dialog.open) {
    if (activePopup) { closePopup(true); return; }
    if (mobileOpen) setDrawer(false);
  }
  if (event.key !== 'Tab' || !mobileOpen || dialog.open) return;
  const tabbable = [...rail.querySelectorAll('a[href], button, [tabindex="0"]')].filter(element => element.offsetParent);
  if (!tabbable.length) return;
  if (event.shiftKey && document.activeElement === tabbable[0]) {
    event.preventDefault();
    tabbable.at(-1).focus();
  } else if (!event.shiftKey && document.activeElement === tabbable.at(-1)) {
    event.preventDefault();
    tabbable[0].focus();
  }
});

main.addEventListener('input', event => {
  if (event.target.dataset.filter !== 'query') return;
  view.query = event.target.value;
  view.tablePage = 1;
  renderResults();
});

main.addEventListener('change', event => {
  const { filter } = event.target.dataset;
  if (!filter || filter === 'query') return;
  view.tablePage = 1;
  if (filter === 'group' || filter === 'partner') {
    filters[filter] = event.target.value;
    if (filter === 'group' && filters.partner && !data.partners.some(p => p.id === filters.partner && (!filters.group || p.group === filters.group))) {
      filters.partner = '';
    }
    if (view.link && !ctx().ids.includes(data.links.find(l => l.id === view.link)?.partner)) view.link = '';
    renderMain();
    main.querySelector(`[data-filter="${filter}"]`)?.focus({ preventScroll: true });
  } else {
    view[filter] = event.target.value;
    renderResults();
  }
});

dialog.addEventListener('input', event => {
  if (!event.target.matches('[data-command-input]')) return;
  panels.at(-1).query = event.target.value;
  dialog.querySelector('#command-results').innerHTML = commandResults(ctx(), allNavigation(), event.target.value);
});

dialog.addEventListener('keydown', event => {
  const input = dialog.querySelector('[data-command-input]');
  if (!input || !['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
  const results = [...dialog.querySelectorAll('.command-result')];
  const index = results.indexOf(document.activeElement);
  if (event.key === 'Enter') {
    if (document.activeElement !== input || !results.length) return;
    event.preventDefault();
    results[0].click();
    return;
  }
  if (document.activeElement !== input && index < 0) return;
  event.preventDefault();
  const next = event.key === 'ArrowDown' ? results[index + 1] : results[index < 0 ? results.length - 1 : index - 1];
  (next ?? input).focus();
});

dialog.addEventListener('change', event => {
  if (event.target.closest('form')?.dataset.form !== 'date') return;
  if (!['start', 'end'].includes(event.target.name)) return;
  dialog.querySelector('[name="preset"]').value = 'custom';
  dialog.querySelectorAll('[data-action="preset"]').forEach(button => button.setAttribute('aria-pressed', 'false'));
});

function saveCampaign(fields, id) {
  merchantOnly();
  const code = fields.code.toUpperCase();
  const existing = id && findData('campaigns', id);
  if (existing && existing.state !== 'draft') throw new Error('Chỉ bản nháp có thể chỉnh sửa.');
  if (!existing && data.campaigns.some(c => c.id === code)) throw new Error('Mã chiến dịch đã được sử dụng.');
  if (!fields.name || !fields.description || !fields.owner) throw new Error('Nhập tên chiến dịch, người phụ trách và thể lệ.');
  if (fields.end < fields.start || fields.end < TODAY) throw new Error('Ngày kết thúc cần từ ngày bắt đầu trở đi và chưa qua.');
  const value = Number(fields.value);
  if ((fields.kind === 'rate' && value > 100) || (fields.kind === 'multiplier' && value > 10) ||
    (fields.kind === 'fixed' && !Number.isInteger(value))) throw new Error('Giá trị hoa hồng không hợp lệ với loại chính sách đã chọn.');
  const details = {
    id: code, name: fields.name, start: fields.start, end: fields.end, group: fields.group, state: 'draft',
    mode: fields.mode, kind: fields.kind, value, target: Number(fields.target), budget: Number(fields.budget),
    owner: fields.owner, eligibleProduct: fields.eligibleProduct, description: fields.description, members: {},
  };
  if (existing) Object.assign(existing, details);
  else data.campaigns.unshift(details);
  update('Đã lưu bản nháp chiến dịch.', `Lưu bản nháp ${details.name}.`, () => detailPanel(ctx(), 'campaign', code));
}

function submitForm(form, fields) {
  const type = form.dataset.form;
  const id = form.dataset.id;
  switch (type) {
    case 'date': {
      if (fields.start > fields.end || !Number.isFinite(numDays(fields.start, fields.end))) throw new Error('Ngày kết thúc cần từ ngày bắt đầu trở đi.');
      range = { start: fields.start, end: fields.end, preset: fields.preset };
      view.tablePage = 1;
      persistPreferences();
      closeDialog();
      renderMain();
      main.querySelector('[data-action="date-filter"]')?.focus({ preventScroll: true });
      break;
    }
    case 'campaign':
      saveCampaign(fields, id);
      break;
    case 'policy': {
      merchantOnly();
      if (fields.effective < TODAY) throw new Error('Chọn ngày hiệu lực từ hôm nay trở đi.');
      if (data.policies.some(p => p.effective === fields.effective)) throw new Error('Ngày này đã có phiên bản chính sách.');
      const id = 'v1.' + data.policies.length;
      data.policies.push({
        id, effective: fields.effective, DSGD: +fields.DSGD, DSSV: +fields.DSSV, hold: +fields.hold,
        attribution: +fields.attribution, threshold: +fields.threshold, cadence: fields.cadence,
        landing: fields.landing, enabled: fields.enabled === 'on',
      });
      data.policies.sort((a, b) => a.effective.localeCompare(b.effective));
      update('Đã lưu phiên bản chính sách.', `Tạo chính sách ${id}, hiệu lực từ ${date(fields.effective)}.`);
      break;
    }
    case 'approve-partner': {
      merchantOnly();
      const partner = findData('partners', id);
      if (!['pending', 'paused'].includes(partner.status) || !GROUPS[fields.group]) throw new Error('Hồ sơ đã thay đổi hoặc nhóm đối tác chưa hợp lệ.');
      partner.status = 'active';
      partner.approvedAt = TODAY;
      partner.group = fields.group;
      if (!data.links.some(l => l.partner === partner.id)) newLink(data, { partner: id, channel: partner.channel, code: id + '-NARRA' });
      for (const campaign of data.campaigns.filter(c => c.mode === 'auto' && ['live', 'scheduled'].includes(campaignStatus(c)) && inAudience(c, partner))) campaign.members[id] = 'joined';
      update('Đối tác đã có quyền tham gia chương trình.', `Duyệt đối tác ${partner.name}, nhóm ${groupName(partner.group)}.`, () => detailPanel(ctx(), 'partner', id));
      break;
    }
    case 'link': {
      if (role === 'affiliate' && fields.partner !== PARTNER_ID) throw new Error('Chọn hồ sơ của bạn để tạo link.');
      if (!policyAt(data).enabled) throw new Error('Chương trình đang tạm dừng.');
      if (fields.campaign) {
        const campaign = findData('campaigns', fields.campaign);
        const partner = findData('partners', fields.partner);
        if (campaign.members[fields.partner] !== 'joined' || !inAudience(campaign, partner) || !['live', 'scheduled'].includes(campaignStatus(campaign))) {
          throw new Error('Đối tác cần tham gia chiến dịch trước khi tạo link.');
        }
      }
      const link = newLink(data, fields);
      update('Đã tạo link giới thiệu.', `Tạo link ${link.code}.`, () => detailPanel(ctx(), 'link', link.id));
      break;
    }
    case 'order-approve': case 'order-reject': case 'order-refund': {
      merchantOnly();
      const order = findData('orders', id);
      if (type === 'order-refund') {
        if (!fields.reason) throw new Error('Nhập lý do hoàn tiền.');
        refundOrder(data, order, +fields.amount, fields.reason);
      } else {
        if (type === 'order-reject' && !fields.reason) throw new Error('Nhập lý do từ chối.');
        decideOrder(data, order, type === 'order-approve' ? 'approved' : 'rejected', fields.reason, fields.link);
      }
      update('Đã cập nhật giao dịch.', `Cập nhật đơn ${order.id}, ${statusText(orderStatus(order)).toLocaleLowerCase('vi')}.`,
        () => detailPanel(ctx(), 'order', order.id));
      break;
    }
    case 'new-batch': {
      merchantOnly();
      const entries = eligiblePayoutEntries(data, ctx().ids);
      if (!fields.name || !entries.length) throw new Error('Kiểm tra tên kỳ và các khoản đủ điều kiện.');
      const id = `PO-2611-${String(data.batches.length + 1).padStart(2, '0')}`;
      const batch = { id, name: fields.name, created: TODAY, paidAt: '', ref: '', entries };
      data.batches.push(batch);
      for (const entry of entries.filter(e => e.adjustmentId)) {
        const adjustment = data.adjustments.find(a => a.id === entry.adjustmentId);
        if (adjustment) adjustment.batch = id;
      }
      view.tab = 'batches';
      update('Đã lập kỳ đối soát.', `Lập kỳ ${id}, tổng ${money(sum(entries))}.`, () => detailPanel(ctx(), 'batch', id));
      break;
    }
    case 'pay-batch': {
      merchantOnly();
      const batch = findData('batches', id);
      if (batch.paidAt || !fields.ref || fields.date < batch.created || fields.date > TODAY) throw new Error('Kiểm tra mã tham chiếu và ngày chi.');
      if (data.batches.some(b => b.ref.toLocaleLowerCase() === fields.ref.toLocaleLowerCase())) throw new Error('Mã tham chiếu đã được dùng.');
      batch.paidAt = fields.date;
      batch.ref = fields.ref;
      update('Đã ghi nhận kỳ chi trả.', `Ghi nhận chi trả kỳ ${batch.id}.`, () => detailPanel(ctx(), 'batch', id));
      break;
    }
    case 'profile': {
      if (role !== 'affiliate' || !fields.name) throw new Error('Nhập tên hiển thị của bạn.');
      if (Boolean(fields.bank) !== Boolean(fields.bankLast4)) throw new Error('Nhập cả tên ngân hàng và 4 số cuối, hoặc xóa cả hai.');
      const changed = fields.bank !== data.profile.bank || fields.bankLast4 !== data.profile.bankLast4;
      Object.assign(data.profile, fields);
      if (changed) data.profile.verification = fields.bank ? 'Thông tin nhận tiền đang chờ xác minh.' : '';
      update('Đã lưu thông tin hồ sơ.');
      break;
    }
    case 'ticket': {
      if (!fields.body || fields.body.length < 8) throw new Error('Mô tả thêm thông tin để đội vận hành có thể đối chiếu.');
      const ticket = { id: `HT-${String(data.tickets.length + 1).padStart(3, '0')}`, at: TODAY, body: fields.body, partner: role === 'affiliate' ? PARTNER_ID : '', order: id };
      data.tickets.unshift(ticket);
      update(`Đã lưu yêu cầu ${ticket.id}.`);
      if (page !== 'support') window.location.hash = route(role, 'support');
      break;
    }
  }
}

dialog.addEventListener('submit', event => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  const fields = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, String(value).trim()]));
  const errorMessage = form.querySelector('.form-error');
  errorMessage.hidden = true;
  try { submitForm(form, fields); }
  catch (error) { errorMessage.textContent = error.message; errorMessage.hidden = false; }
});

const referralCode = new URLSearchParams(location.search).get('ref')?.toUpperCase();
let clickEventKey = '';
let trial = { lead: false, plus: false };
function referralLink() {
  return data.links.find(link => link.code === referralCode && link.active &&
    data.partners.some(p => p.id === link.partner && p.status === 'active') && policyAt(data).enabled);
}

function startReferral() {
  const link = referralLink();
  if (link) {
    try { clickEventKey = sessionStorage.getItem('narra-click-' + link.id) ?? ''; } catch {}
    if (!data.activity.some(e => e.track === clickEventKey && clickEventKey)) {
      clickEventKey = 'TR-' + Date.now();
      data.activity.push({ at: TODAY, partner: link.partner, link: link.id, campaign: link.campaign, click: 1, unique: 1, l0: 0, free: 0, track: clickEventKey });
      saveState(data);
      try { sessionStorage.setItem('narra-click-' + link.id, clickEventKey); } catch {}
    }
    const tracking = data.activity.find(e => e.track === clickEventKey);
    trial = { lead: tracking.l0 > 0, plus: data.orders.some(o => o.track === clickEventKey) };
  }
  drawReferral();
}

function drawReferral() {
  const link = referralLink();
  shell.hidden = true;
  let area = document.querySelector('.referral');
  if (!area) { area = document.createElement('main'); area.className = 'referral'; document.body.prepend(area); }
  area.innerHTML = `<section class="card">${brandMark}
    <h1>Narra Speaking Coach</h1><p>${link ? `Bạn đang mở link ${esc(link.code)}. Tại đây bạn có thể thử luồng đăng ký Free và mua Plus.` : 'Link giới thiệu này hiện không khả dụng.'}</p>
    <div class="referral-actions">
      ${link ? `<button class="btn btn-secondary" data-action="simulate-lead" ${trial.lead ? 'disabled' : ''}>${trial.lead ? 'Đã ghi nhận đăng ký Free' : 'Mô phỏng đăng ký Free'}</button>
      <button class="btn btn-primary" data-action="simulate-plus" ${trial.plus ? 'disabled' : ''}>${trial.plus ? 'Đã ghi nhận đơn Plus' : 'Mô phỏng mua Plus'}</button>` : ''}
      <a class="btn btn-secondary" href="${location.pathname}${route('affiliate', 'overview')}">Về cổng Đại sứ</a>
    </div>
  </section>`;
}

function simulate(type) {
  const link = referralLink();
  const tracking = data.activity.find(e => e.track === clickEventKey);
  if (!link || !tracking) throw new Error('Link giới thiệu hiện không khả dụng.');
  if (!trial.lead) {
    tracking.l0 = 1;
    tracking.free = 1;
    trial.lead = true;
  }
  if (type === 'plus' && !trial.plus) {
    const partner = findData('partners', link.partner);
    const policy = policyAt(data);
    const candidate = data.campaigns.find(c => c.id === link.campaign && campaignStatus(c) === 'live' && c.members[partner.id] === 'joined' && inAudience(c, partner));
    const orderProduct = candidate?.eligibleProduct ?? 'Narra Plus';
    const amount = orderProduct === 'Narra Plus' ? 199000 : 399000;
    const baseRate = policy[partner.group];
    const enhancedRate = candidate?.kind === 'rate' ? candidate.value : baseRate * (candidate?.kind === 'multiplier' ? candidate.value : 1);
    const bonus = candidate?.kind === 'fixed' ? candidate.value : 0;
    const claimed = data.orders.filter(o => o.campaign === candidate?.id).reduce((total, o) =>
      total + Math.max(0, commission(o) - Math.round((o.amount - o.refund) * o.baseRate / 100)), 0);
    const promised = Math.round(amount * enhancedRate / 100) + bonus - Math.round(amount * baseRate / 100);
    const applied = candidate && claimed + promised <= candidate.budget;
    const rate = applied ? enhancedRate : baseRate;
    const order = {
      id: 'NR-' + String(Date.now()).slice(-8), partner: partner.id, link: link.id, campaign: applied ? candidate.id : '',
      product: orderProduct, created: TODAY, paidAt: TODAY, approved: '', holdDays: policy.hold, version: policy.id,
      amount, baseRate, rate, bonus: applied ? bonus : 0, status: 'pending', refund: 0, track: clickEventKey,
      history: [{ at: TODAY, text: 'Ghi nhận giao dịch mô phỏng qua link giới thiệu.' }],
    };
    data.orders.push(order);
    trial.plus = true;
  }
  saveState(data);
  drawReferral();
  toast(type === 'plus' ? 'Đã ghi nhận đơn Plus đang chờ xác minh.' : 'Đã ghi nhận một đăng ký hợp lệ và kích hoạt Free.');
}

mobile.addEventListener('change', () => {
  closePopup();
  if (!mobile.matches) setDrawer(false, false);
  renderSidebarState();
});

window.addEventListener('storage', event => {
  if (event.key !== 'narra-affiliate-pilot-v1') return;
  data = readState();
  if (referralCode) {
    const tracking = data.activity.find(e => e.track === clickEventKey);
    trial = { lead: tracking?.l0 > 0, plus: data.orders.some(o => o.track === clickEventKey) };
    drawReferral();
  } else render();
});
window.addEventListener('hashchange', syncRoute);

document.documentElement.dataset.theme = theme;
if (referralCode) startReferral();
else {
  routeSignature = window.location.hash;
  parseRoute();
  render();
}

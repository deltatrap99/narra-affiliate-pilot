import { PARTNER_ID, inAudience, orderStatus, date } from './model.js';
import { icon, esc, matches, route, statusText, groupName } from './ui.js';
import { partnerCode } from './partner-profile.js';

export function appearanceMenu(theme, layout) {
  const choices = (setting, options, selected) => options.map(([key, label, glyph]) => `<button class="appearance-option" type="button" data-action="appearance" data-type="${setting}" data-value="${key}" aria-pressed="${selected === key}">${icon(glyph)}<span>${label}</span></button>`).join('');
  return `<div class="popover appearance-menu" id="appearance" hidden>
    <p class="popover-title">Giao diện</p>
    <div class="appearance-group" role="group" aria-label="Chế độ màu">
      <span>Chế độ màu</span><div>${choices('theme', [['light', 'Sáng', 'light_mode'], ['dark', 'Tối', 'dark_mode']], theme)}</div>
    </div>
    <div class="appearance-group" role="group" aria-label="Điều hướng trên máy tính">
      <span>Điều hướng trên máy tính</span><div>${choices('layout', [['vertical', 'Dọc', 'view_sidebar'], ['horizontal', 'Ngang', 'view_agenda']], layout)}</div>
    </div>
  </div>`;
}

function commandEntry(item) {
  const { label, caption, symbol, page, type, id, role } = item;
  const content = `<span class="command-icon">${icon(symbol)}</span><span class="command-text"><strong>${esc(label)}</strong><small>${esc(caption)}</small></span>`;
  return page ? `<a class="command-result" href="${route(role, page)}">${content}</a>` :
    `<button class="command-result" type="button" data-action="detail" data-type="${type}" data-id="${esc(id)}">${content}</button>`;
}

export function commandResults(ctx, nav, search) {
  const { role, data } = ctx;
  const query = search.trim();
  const sections = nav.filter(([, label]) => matches(query, label))
    .map(([page, label, symbol]) => ({ page, label, symbol, role, caption: 'Đi đến màn hình' }));
  const results = [];
  if (query) {
    const merchant = role === 'merchant';
    const affiliate = data.partners.find(p => p.id === PARTNER_ID);
    for (const c of data.campaigns) {
      if ((!merchant && (c.state === 'draft' || !inAudience(c, affiliate))) || !matches(query, c.name, c.id)) continue;
      results.push({ label: c.name, caption: `Chiến dịch · ${c.id}`, symbol: 'campaign', type: 'campaign', id: c.id });
    }
    if (merchant) {
      for (const p of data.partners) {
        if (!matches(query, p.name, partnerCode(p), groupName(p.group))) continue;
        results.push({ label: p.name, caption: `Đối tác · ${partnerCode(p)}`, symbol: 'group', type: 'partner', id: p.id });
      }
    }
    for (const o of [...data.orders].reverse()) {
      if ((!merchant && o.partner !== PARTNER_ID) || !matches(query, o.id, o.product)) continue;
      results.push({ label: o.id, caption: `${o.product} · ${date(o.paidAt)} · ${statusText(orderStatus(o))}`, symbol: 'shopping_bag', type: 'order', id: o.id });
    }
    for (const link of data.links) {
      if ((!merchant && link.partner !== PARTNER_ID) || !matches(query, link.code, link.coupon)) continue;
      results.push({ label: link.code, caption: `Link giới thiệu · ${link.channel}`, symbol: 'link', type: 'link', id: link.id });
    }
  }
  const top = results.slice(0, Math.max(4, 12 - sections.length));
  if (!sections.length && !top.length) {
    return '<p class="command-empty">Chưa tìm thấy kết quả. Thử tên chiến dịch, đối tác hoặc mã đơn.</p>';
  }
  const group = (title, rows) => rows.length ? `<div class="command-group"><p>${title}</p>${rows.map(commandEntry).join('')}</div>` : '';
  return group('Điều hướng', sections) + group('Dữ liệu chương trình', top);
}

export function commandPanel(ctx, nav) {
  return {
    title: 'Tìm trong Narra', size: 'command-dialog',
    body: `<label class="command-input">${icon('search')}<span class="sr-only">Tên màn hình, đối tác, mã đơn hoặc chiến dịch</span>
      <input type="search" data-command-input placeholder="Tìm tên hoặc mã..." autocomplete="off"></label>
      <div id="command-results">${commandResults(ctx, nav, '')}</div>`,
  };
}

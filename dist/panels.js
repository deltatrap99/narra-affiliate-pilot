import {
  TODAY, GROUPS, PARTNER_ID, date, number, money, percent, presets, includesDate, stats, policyAt,
  campaignStatus, inAudience, commission, orderStatus, earningStatus, holdEnd, batchFor, eligiblePayoutEntries,
} from './model.js';
import {
  icon, esc, action, route, badge, avatar, formatRange, groupName, optionList, note, recordLink, table, statusText, sum,
} from './ui.js';
import { campaignBenefit, linkURL, metrics, orderTable } from './views.js';

const detail = (type, id) => `data-type="${type}" data-id="${esc(id)}"`;
const withId = id => `data-id="${esc(id)}"`;
const mayRead = (ctx, id) => ctx.role === 'merchant' || id === PARTNER_ID;
const isMerchant = ctx => ctx.role === 'merchant';
const partnerFor = (ctx, id) => ctx.data.partners.find(p => p.id === id);
const btn = (label, name, id, type = 'primary', symbol = '') => action(label, name, { type, symbol, attributes: id ? withId(id) : '' });
const submit = (label, className = 'primary') => `<button class="btn btn-${className}" type="submit">${esc(label)}</button>`;
const cancel = () => action('Đóng', 'close-dialog');
const footer = (...buttons) => buttons.filter(Boolean).join('');
const fields = (...pieces) => `<div class="form-grid">${pieces.join('')}</div>`;
const detailGrid = pairs => `<dl class="details-grid">${pairs.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
const entry = (label, name, value, type = 'text', attributes = '', wide = false) => `<label class="field ${wide ? 'wide-field' : ''}"><span>${esc(label)}</span><input name="${name}" type="${type}" value="${esc(value)}" ${attributes}></label>`;
const selectField = (label, name, items, value) => `<label class="field"><span>${esc(label)}</span><select name="${name}">${optionList(items, value)}</select></label>`;
const textarea = (label, name, value = '', min = 1) => `<label class="field wide-field"><span>${esc(label)}</span><textarea name="${name}" required minlength="${min}" maxlength="500" rows="3">${esc(value)}</textarea></label>`;
const checks = (name, label, checked) => `<label class="field-check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}>${esc(label)}</label>`;

export function datePanel(ctx) {
  return {
    title: 'Khoảng thời gian', size: 'compact', form: 'date',
    body: `<div class="preset-buttons">${[['7', '7 ngày'], ['30', '30 ngày'], ['month', 'Tháng 11']].map(([key, label]) => action(label, 'preset', {
      attributes: `data-value="${key}" aria-pressed="${ctx.range.preset === key}"`,
    })).join('')}</div>${fields(
      entry('Từ ngày', 'start', ctx.range.start, 'date', `required min="2026-09-01" max="${TODAY}"`),
      entry('Đến ngày', 'end', ctx.range.end, 'date', `required min="2026-09-01" max="${TODAY}"`),
    )}<input name="preset" value="${esc(ctx.range.preset)}" type="hidden">${note('Khoảng thời gian này được giữ khi bạn chuyển màn hình hoặc vai trò.')}`,
    footer: footer(cancel(), submit('Áp dụng bộ lọc')),
  };
}

export function campaignForm(ctx, campaign = null) {
  return {
    title: campaign ? 'Sửa chiến dịch nháp' : 'Tạo chiến dịch',
    subtitle: 'Lưu thiết lập trước khi công bố thể lệ cho Đại sứ.',
    form: 'campaign', id: campaign?.id,
    body: fields(
      entry('Tên chiến dịch', 'name', campaign?.name, 'text', 'required maxlength="70"'),
      entry('Mã chiến dịch', 'code', campaign?.id, 'text', 'required pattern="[A-Za-z0-9\\-]{3,20}" maxlength="20" placeholder="VD: NARRA12"' + (campaign ? ' readonly' : '')),
      entry('Bắt đầu', 'start', campaign?.start ?? TODAY, 'date', 'required'),
      entry('Kết thúc', 'end', campaign?.end ?? '2026-11-30', 'date', 'required'),
      selectField('Đối tượng tham gia', 'group', [['all', 'Tất cả Đại sứ'], ...Object.entries(GROUPS)], campaign?.group ?? 'all'),
      selectField('Cách tham gia', 'mode', [['open', 'Tự đăng ký'], ['approval', 'Đăng ký, chờ duyệt'], ['auto', 'Tự động tham gia']], campaign?.mode ?? 'open'),
      selectField('Chính sách hoa hồng', 'kind', [['multiplier', 'Nhân hệ số'], ['rate', 'Tỷ lệ riêng (%)'], ['fixed', 'Thưởng cố định mỗi đơn (₫)']], campaign?.kind ?? 'multiplier'),
      entry('Giá trị chính sách', 'value', campaign?.value ?? 2, 'number', 'required min="0.1" step="0.1"'),
      entry('Mục tiêu đơn hợp lệ mỗi Đại sứ', 'target', campaign?.target ?? 3, 'number', 'required min="1" step="1"'),
      entry('Ngân sách thưởng (₫)', 'budget', campaign?.budget ?? 1000000, 'number', 'required min="0" step="1000"'),
      selectField('Sản phẩm đủ điều kiện', 'eligibleProduct', [['Narra Plus', 'Narra Plus'], ['Combo Narra + đối tác', 'Combo Narra + đối tác']], campaign?.eligibleProduct ?? 'Narra Plus'),
      entry('Người phụ trách', 'owner', campaign?.owner ?? 'Narra Admin', 'text', 'required maxlength="60"'),
      textarea('Thể lệ hiển thị cho Đại sứ', 'description', campaign?.description),
    ) + note('Hoa hồng bổ sung xét theo ngày thanh toán. Mỗi đơn ghi nhận phần thưởng từ chiến dịch của link được xác minh.'),
    footer: footer(cancel(), submit('Lưu bản nháp')),
  };
}

function campaignDetail(ctx, campaign) {
  const person = partnerFor(ctx, PARTNER_ID);
  const merchant = isMerchant(ctx);
  if (!merchant && (campaign.state === 'draft' || !inAudience(campaign, person))) return null;
  const state = campaignStatus(campaign);
  const member = campaign.members[PARTNER_ID];
  const eligible = inAudience(campaign, person) && person.status === 'active' && policyAt(ctx.data).enabled;
  const candidates = Object.entries(campaign.members);
  const totals = stats(ctx.data, ctx.ids, ctx.range, { campaign: campaign.id });
  const awarded = ctx.data.orders.filter(o => o.campaign === campaign.id && o.status === 'approved')
    .reduce((total, o) => total + Math.max(0, commission(o) - Math.round((o.amount - o.refund) * o.baseRate / 100)), 0);
  const relevant = ctx.data.orders.filter(o => o.campaign === campaign.id && ctx.ids.includes(o.partner) && includesDate(o.paidAt, ctx.range))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const activeLink = ctx.data.links.find(l => l.partner === PARTNER_ID && l.campaign === campaign.id && l.active);
  const roster = merchant ? `<h3 class="dialog-subtitle">Danh sách tham gia</h3>${table(['Đối tác', 'Trạng thái', 'Thao tác'], candidates.map(([id, status]) => [
    recordLink('partner', id, partnerFor(ctx, id)?.name ?? id),
    badge(status, status === 'pending' ? 'Chờ duyệt' : undefined),
    status === 'pending' ? action('Duyệt tham gia', 'approve-enrollment', { type: 'small', attributes: `data-id="${esc(campaign.id)}" data-partner="${esc(id)}"` }) : 'Đã xử lý',
  ]), 'Chưa có đăng ký tham gia', '')}` : '';
  return {
    title: campaign.name,
    subtitle: `${campaign.id} · ${formatRange({ start: campaign.start, end: campaign.end })}`,
    size: 'wide',
    body: `${badge(state)}<p>${esc(campaign.description)}</p>
    ${detailGrid([
      ['Quyền lợi', esc(campaignBenefit(campaign))], ['Đối tượng', esc(groupName(campaign.group))],
      ['Gói đủ điều kiện', esc(campaign.eligibleProduct)], ['Cách tham gia', campaign.mode === 'approval' ? 'Chờ đội vận hành duyệt' : campaign.mode === 'auto' ? 'Tham gia tự động' : 'Tự đăng ký'],
      ['Mục tiêu cá nhân', `${number(campaign.target)} đơn hợp lệ`], ['Quy tắc áp dụng', 'Theo ngày thanh toán, mỗi đơn ghi nhận một chiến dịch'],
      ...(merchant ? [['Người phụ trách', esc(campaign.owner)], ['Ngân sách thưởng', `${money(awarded)} / ${money(campaign.budget)}`]]
        : [['Trạng thái của bạn', member ? badge(member, member === 'pending' ? 'Chờ duyệt' : undefined) : 'Chưa tham gia'],
          ['Tiến độ trong khoảng đã chọn', `${number(totals.plus)} / ${number(campaign.target)} đơn Plus`]]),
    ])}
    <h3>Hiệu quả từ ${formatRange(ctx.range)}</h3>
    ${detailGrid([
      ['Lượt nhấp / riêng biệt', `${number(totals.click)} / ${number(totals.unique)}`],
      ['L0 / Free / Plus', `${number(totals.l0)} / ${number(totals.free)} / ${number(totals.plus)}`],
      ['Doanh thu sau hoàn', money(totals.revenue)], ['Hoa hồng phát sinh', money(totals.com)],
    ])}
    ${merchant && relevant.length ? `<h3>Đơn thuộc chiến dịch</h3>${orderTable(ctx, relevant)}` : ''}
    ${roster}
    ${!merchant && member === 'joined' ? `<h3>Tài nguyên chiến dịch</h3><p>${activeLink ? recordLink('link', activeLink.id, activeLink.code) : btn('Tạo link chiến dịch', 'new-link', campaign.id, 'secondary', 'link')} <a class="text-link" download href="assets/pilot-ribbon.webp">Tải banner</a></p>` : ''}
    ${campaign.id === 'GOLDEN26' ? note('Mức nhân đôi trong Golden Days là ví dụ dùng để kiểm tra luồng duyệt và đối soát.') : ''}`,
    footer: footer(cancel(),
      merchant && relevant.length ? action('Xuất báo cáo', 'export', { type: 'secondary', symbol: 'download', attributes: detail('campaign', campaign.id) }) : '',
      merchant && state === 'draft' ? btn('Sửa bản nháp', 'edit-campaign', campaign.id, 'secondary', 'edit') : '',
      merchant && state === 'draft' ? btn('Công bố', 'publish-campaign', campaign.id, 'primary', 'campaign') : '',
      merchant && ['scheduled', 'live'].includes(state) ? btn('Tạm dừng', 'pause-campaign', campaign.id, 'secondary') : '',
      merchant && state === 'paused' ? btn('Mở lại', 'publish-campaign', campaign.id) : '',
      !merchant && eligible && !member && ['live', 'scheduled'].includes(state)
        ? btn(campaign.mode === 'approval' ? 'Gửi đăng ký' : 'Tham gia', 'join-campaign', campaign.id, 'primary', 'check') : ''),
  };
}

function partnerDetail(ctx, partner) {
  if (!mayRead(ctx, partner.id)) return null;
  const merchant = isMerchant(ctx);
  const p = policyAt(ctx.data);
  const values = stats(ctx.data, [partner.id], ctx.range);
  const rows = ctx.data.orders.filter(o => o.partner === partner.id && includesDate(o.paidAt, ctx.range))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const links = ctx.data.links.filter(l => l.partner === partner.id);
  const batches = ctx.data.batches.filter(b => b.entries.some(e => e.partner === partner.id));
  return {
    title: partner.name, subtitle: `${partner.id} · ${groupName(partner.group)}`, size: 'wide',
    body: `<div class="person-cell">${avatar(partner, 'large')}${badge(partner.status, partner.status === 'pending' ? 'Chờ duyệt hồ sơ' : undefined)}</div>
    ${detailGrid([
      ['Ngày gửi hồ sơ', date(partner.joined)], ['Kênh chính', esc(partner.channel)],
      ['Nhóm đối tác', esc(groupName(partner.group))], ['Hoa hồng nền hiện hành', percent(p[partner.group])],
      ['L0 / Free / Plus', `${number(values.l0)} / ${number(values.free)} / ${number(values.plus)}`], ['Hoa hồng trong kỳ', money(values.com)],
    ])}
    <h3>Link giới thiệu</h3>
    <p>${links.length ? links.map(l => recordLink('link', l.id, l.code)).join(' · ') : 'Chưa có link giới thiệu.'}</p>
    <h3>Đơn Plus trong khoảng ${formatRange(ctx.range)}</h3>
    ${orderTable({ ...ctx, role: 'affiliate' }, rows)}
    <h3>Lịch sử chi trả</h3>
    ${table(['Kỳ đối soát', 'Ngày chi', 'Số tiền'], batches.map(b => [
      recordLink('batch', b.id, b.name), date(b.paidAt), money(sum(b.entries.filter(e => e.partner === partner.id))),
    ]), 'Chưa có kỳ chi trả', '')}`,
    footer: footer(cancel(),
      merchant && partner.status === 'active' ? btn('Tạm ngưng', 'pause-partner', partner.id, 'secondary') : '',
      merchant && partner.status === 'pending' ? btn('Từ chối', 'reject-partner', partner.id, 'danger') : '',
      merchant && ['pending', 'paused'].includes(partner.status) ? btn(partner.status === 'pending' ? 'Duyệt hồ sơ' : 'Kích hoạt lại', 'approve-partner', partner.id, 'primary', 'check') : ''),
  };
}

export function partnerForm(ctx, id) {
  const p = partnerFor(ctx, id);
  if (!p) return null;
  return {
    title: p.status === 'pending' ? 'Duyệt hồ sơ đối tác' : 'Kích hoạt đối tác',
    subtitle: p.name, form: 'approve-partner', id, size: 'compact',
    body: fields(selectField('Nhóm đối tác', 'group', Object.entries(GROUPS), p.group))
      + note('Nhóm được gán quyết định chính sách áp dụng cho đơn phát sinh sau khi hồ sơ được duyệt.'),
    footer: footer(cancel(), submit('Xác nhận')),
  };
}

function orderDetail(ctx, order) {
  if (!mayRead(ctx, order.partner)) return null;
  const merchant = isMerchant(ctx);
  const partner = partnerFor(ctx, order.partner);
  const link = ctx.data.links.find(l => l.id === order.link);
  const batch = batchFor(ctx.data, order.id);
  const campaign = ctx.data.campaigns.find(c => c.id === order.campaign);
  return {
    title: `Đơn ${order.id}`, subtitle: order.product,
    body: `${badge(orderStatus(order), order.conflict && merchant ? 'Xung đột nguồn giới thiệu' : undefined)}
      ${order.conflict && merchant ? note(order.attribution) : ''}
      ${detailGrid([
        ...(merchant ? [['Đối tác', recordLink('partner', partner.id, partner.name)]] : []),
        ['Nguồn giới thiệu', link ? recordLink('link', link.id, link.code) : 'Chưa có'], ['Chiến dịch', campaign ? recordLink('campaign', campaign.id, campaign.name) : 'Chương trình chung'],
        ['Ngày phát sinh', date(order.created)], ['Ngày thanh toán', date(order.paidAt)], ['Ngày xác nhận', date(order.approved)],
        ['Ngày hết giữ', date(holdEnd(order))], ['Giá trị thanh toán', money(order.amount)], ['Hoàn tiền', money(order.refund)],
        ['Giá trị đủ điều kiện', money(order.amount - order.refund)], ['Phiên bản chính sách', recordLink('policy', order.version)],
        ['Mức hoa hồng', `${percent(order.rate)}${order.bonus ? ' + ' + money(order.bonus) : ''}`],
        ['Hoa hồng hiện tại', money(commission(order))], ['Trạng thái chi', badge(earningStatus(ctx.data, order))],
        ...(batch ? [['Kỳ đối soát', recordLink('batch', batch.id)], ['Ngày chi', date(batch.paidAt)]] : []),
      ])}
      ${order.reason ? note(order.reason) : ''}
      <h3>Lịch sử xử lý</h3><ol class="history-list">${order.history.map(log => `<li><time>${date(log.at)}</time><div>${esc(log.text)}${log.reason ? `<small>${esc(log.reason)}</small>` : ''}</div></li>`).join('')}</ol>`,
    footer: footer(cancel(),
      merchant && order.status === 'pending' && order.refund < order.amount ? btn('Từ chối', 'decision-reject', order.id, 'danger') : '',
      merchant && order.status === 'pending' && order.refund < order.amount ? btn('Xác nhận đơn', 'decision-approve', order.id, 'primary', 'check') : '',
      merchant && order.status === 'approved' && order.refund < order.amount ? btn('Ghi nhận hoàn tiền', 'refund-order', order.id, 'danger') : '',
      !merchant ? btn('Gửi yêu cầu về đơn', 'new-ticket', order.id, 'secondary') : ''),
  };
}

export function orderForm(ctx, id, type) {
  const o = ctx.data.orders.find(row => row.id === id);
  if (!o || !isMerchant(ctx)) return null;
  const approval = type === 'approve';
  const refund = type === 'refund';
  const potentialLinks = ctx.data.links.filter(l => l.created <= o.paidAt);
  return {
    title: refund ? 'Ghi nhận hoàn tiền' : approval ? 'Xác nhận đơn hàng' : 'Từ chối đơn hàng',
    subtitle: o.id, form: `order-${type}`, id, size: 'compact',
    body: refund ? fields(entry('Số tiền hoàn (₫)', 'amount', o.amount - o.refund, 'number', `required min="1" max="${o.amount - o.refund}" step="1"`),
      textarea('Lý do hoàn tiền', 'reason'))
      + (batchFor(ctx.data, o.id)?.paidAt ? note('Khoản hoa hồng đã chi sẽ được thu hồi ở kỳ đối soát tiếp theo.') : '')
      : approval ? (
        o.conflict ? fields(selectField('Nguồn giới thiệu được xác minh', 'link', potentialLinks.map(l => [l.id, `${l.code} · ${partnerFor(ctx, l.partner)?.name}`]), o.link))
          + note(o.attribution)
          : note(`Sau khi xác nhận, khoản hoa hồng được giữ ${o.holdDays} ngày để theo dõi hoàn hoặc hủy.`))
        : fields(textarea('Lý do từ chối', 'reason')),
    footer: footer(cancel(), submit(refund ? 'Lưu khoản hoàn' : approval ? 'Xác nhận chuyển đổi' : 'Từ chối chuyển đổi', approval ? 'primary' : 'danger')),
  };
}

function batchDetail(ctx, batch) {
  const merchant = isMerchant(ctx);
  const entries = batch.entries.filter(e => ctx.ids.includes(e.partner));
  if (!entries.length) return null;
  return {
    title: batch.name, size: 'wide', subtitle: batch.id,
    body: `${badge(batch.paidAt ? 'paid' : 'batched')}
    ${detailGrid([
      ['Ngày lập kỳ', date(batch.created)], ['Ngày chi', date(batch.paidAt)],
      ['Mã tham chiếu', esc(batch.ref || 'Chưa có')], ['Tổng hoa hồng', money(sum(entries.filter(e => !e.adjustmentId)))],
      ['Điều chỉnh', money(sum(entries.filter(e => e.adjustmentId)))], [batch.paidAt ? 'Thực chi' : 'Dự kiến chi', money(sum(entries))],
    ])}
    <h3>Các khoản cấu thành kỳ đối soát</h3>
    ${table(['Mã đơn', ...(merchant ? ['Đối tác'] : []), 'Loại khoản', 'Số tiền'], entries.map(e => [
      recordLink('order', e.orderId), ...(merchant ? [esc(partnerFor(ctx, e.partner)?.name)] : []),
      e.adjustmentId ? 'Thu hồi sau chi' : 'Hoa hồng', `<strong>${money(e.amount)}</strong>`,
    ]))}`,
    footer: footer(cancel(), action('Tải bảng kê', 'export', { type: 'secondary', symbol: 'download', attributes: detail('batch', batch.id) }),
      merchant && !batch.paidAt && entries.length === batch.entries.length ? btn('Ghi nhận đã chi', 'pay-batch', batch.id, 'primary', 'check') : ''),
  };
}

export function batchForm(ctx, id = '') {
  if (!isMerchant(ctx)) return null;
  if (id) {
    return {
      title: 'Ghi nhận chi trả', form: 'pay-batch', id, size: 'compact',
      body: fields(entry('Mã tham chiếu', 'ref', '', 'text', 'required maxlength="48"'),
        entry('Ngày chi', 'date', TODAY, 'date', `required max="${TODAY}" min="${ctx.data.batches.find(b => b.id === id)?.created}"`))
        + note('Thao tác cập nhật bản ghi thanh toán trong demo.'),
      footer: footer(cancel(), submit('Xác nhận đã chi')),
    };
  }
  const entries = eligiblePayoutEntries(ctx.data, ctx.ids);
  return {
    title: 'Lập kỳ đối soát', size: 'compact', form: entries.length ? 'new-batch' : '',
    body: entries.length ? fields(entry('Tên kỳ đối soát', 'name', `Đối soát ${date(TODAY)}`, 'text', 'required maxlength="60"'))
      + detailGrid([['Số khoản đủ điều kiện', number(entries.length)], ['Dự kiến chi', money(sum(entries))]])
      + note('Đối soát theo số dư hiện tại của đối tác đã chọn, gồm các khoản đã hết giữ và điều chỉnh đủ điều kiện.')
      : note('Các đối tác đang chọn chưa có đủ hoa hồng hết giữ để lập kỳ đối soát.'),
    footer: footer(cancel(), entries.length ? submit('Lập kỳ đối soát') : ''),
  };
}

function linkDetail(ctx, link) {
  if (!mayRead(ctx, link.partner)) return null;
  const totals = stats(ctx.data, [link.partner], ctx.range, { link: link.id });
  const url = linkURL(link.code);
  return {
    title: link.code, subtitle: `Link giới thiệu · ${link.channel}`,
    body: `<div class="link-box">${esc(url)}</div>
      ${detailGrid([
        ['Ngày tạo', date(link.created)], ['Mã ưu đãi', esc(link.coupon || 'Chưa được cấp')],
        ['Lượt nhấp', number(totals.click)], ['Nhấp riêng biệt', number(totals.unique)], ['L0 đăng ký', number(totals.l0)],
        ['Tỷ lệ đăng ký', totals.click ? percent(totals.l0 / totals.click * 100) : '0%'],
        ['Trạng thái', badge(link.active && partnerFor(ctx, link.partner)?.status === 'active' ? 'active' : 'paused')],
      ])}
      ${note('Mở link để mô phỏng một lượt giới thiệu. Kết quả xuất hiện trong cùng trình duyệt.')}`,
    footer: footer(cancel(), `<a class="btn btn-secondary" href="${esc(url)}" target="_blank" rel="noopener">${icon('open_in_new')} Mở link</a>`,
      action('Sao chép link', 'copy', { type: 'primary', symbol: 'content_copy', attributes: `data-value="${esc(url)}"` })),
  };
}

export function linkForm(ctx, campaignId) {
  const partners = ctx.data.partners.filter(p => p.status === 'active' && mayRead(ctx, p.id));
  const campaign = ctx.data.campaigns.find(c => c.id === campaignId);
  const chosen = partners.find(p => !campaign || campaign.members[p.id] === 'joined') ?? partners[0];
  const active = ctx.data.campaigns.filter(c => ['live', 'scheduled'].includes(campaignStatus(c)) &&
    (isMerchant(ctx) || c.members[PARTNER_ID] === 'joined'));
  const code = `${chosen?.id.replace('-', '') ?? 'NARRA'}-${String(Date.now()).slice(-5)}`;
  return {
    title: 'Tạo link giới thiệu', subtitle: 'Gắn một mã riêng để phân biệt nguồn giới thiệu.',
    size: 'compact', form: 'link',
    body: fields(selectField('Đối tác', 'partner', partners.map(p => [p.id, p.name]), chosen?.id),
      selectField('Kênh quảng bá', 'channel', ['Facebook', 'TikTok', 'Instagram', 'YouTube', 'Zalo', 'Khác'].map(value => [value, value]), chosen?.channel),
      entry('Mã giới thiệu', 'code', code, 'text', 'required pattern="[A-Za-z0-9\\-]{3,30}" maxlength="30"'),
      selectField('Chiến dịch', 'campaign', [['', 'Chương trình chung'], ...active.map(c => [c.id, c.name])], campaignId)),
    footer: footer(cancel(), submit('Tạo link')),
  };
}

function policyDetail(ctx, policy) {
  const merchant = isMerchant(ctx);
  const p = partnerFor(ctx, PARTNER_ID);
  return {
    title: `Chính sách ${policy.id}`, subtitle: `Hiệu lực từ ${date(policy.effective)}`, size: 'compact',
    body: detailGrid([
      ...(merchant ? [['Mức ĐSGD', percent(policy.DSGD)], ['Mức ĐSSV', percent(policy.DSSV)]]
        : [['Nhóm của bạn', esc(groupName(p.group))], ['Mức hoa hồng nền', percent(policy[p.group])]]),
      ['Cửa sổ ghi nhận', `${policy.attribution} ngày`], ['Thời gian giữ', `${policy.hold} ngày`],
      ['Ngưỡng chi trả', money(policy.threshold)], ['Lịch chi trả', esc(policy.cadence)],
    ]) + note('Các đơn giữ phiên bản chính sách tại thời điểm ghi nhận thanh toán.'),
    footer: footer(cancel()),
  };
}

export function policyForm(ctx) {
  const p = policyAt(ctx.data);
  return {
    title: 'Tạo phiên bản chính sách',
    subtitle: 'Đặt ngày bắt đầu áp dụng và mức hoa hồng của từng nhóm.',
    form: 'policy',
    body: fields(
      entry('Ngày hiệu lực', 'effective', TODAY, 'date', `required min="${TODAY}"`),
      selectField('Lịch chi trả', 'cadence', [['Hằng tháng', 'Hằng tháng'], ['Hai kỳ mỗi tháng', 'Hai kỳ mỗi tháng']], p.cadence),
      entry('Hoa hồng ĐSGD (%)', 'DSGD', p.DSGD, 'number', 'required min="0" max="100" step="0.1"'),
      entry('Hoa hồng ĐSSV (%)', 'DSSV', p.DSSV, 'number', 'required min="0" max="100" step="0.1"'),
      entry('Cửa sổ ghi nhận (ngày)', 'attribution', p.attribution, 'number', 'required min="1" step="1"'),
      entry('Thời gian giữ (ngày)', 'hold', p.hold, 'number', 'required min="0" step="1"'),
      entry('Ngưỡng chi trả (₫)', 'threshold', p.threshold, 'number', 'required min="0" step="1000"'),
      entry('URL giới thiệu chương trình', 'landing', p.landing, 'url', 'placeholder="https://..."'),
    ) + checks('enabled', 'Chương trình đang hoạt động', p.enabled),
    footer: footer(cancel(), submit('Lưu phiên bản')),
  };
}

export function metricPanel(ctx, key) {
  const item = metrics[key];
  if (!item) return null;
  const fmt = key === 'com' ? money : number;
  const merchant = isMerchant(ctx);
  const value = stats(ctx.data, ctx.ids, ctx.range)[key];
  const rows = merchant ? ctx.partners.map(p => [recordLink('partner', p.id, p.name), fmt(stats(ctx.data, [p.id], ctx.range)[key])]) :
    ctx.data.links.filter(l => l.partner === PARTNER_ID).map(l => [recordLink('link', l.id, l.code), fmt(stats(ctx.data, [l.partner], ctx.range, { link: l.id })[key])]);
  return {
    title: item.name, subtitle: formatRange(ctx.range), size: 'compact',
    body: `${detailGrid([['Tổng trong kỳ', fmt(value)]])}${table([merchant ? 'Đối tác' : 'Nguồn giới thiệu', item.name], rows, 'Chưa có dữ liệu phù hợp')}
    ${note(['com', 'plus'].includes(key) ? 'Số liệu tính theo ngày thanh toán đơn Plus.' : 'Số liệu tính theo ngày ghi nhận lượt giới thiệu.')}`,
    footer: footer(cancel(), `<a class="btn btn-primary" href="${route(ctx.role, ['com', 'plus'].includes(key) ? key === 'com' ? 'payouts' : 'orders' : 'tools')}">${['com', 'plus'].includes(key) ? key === 'com' ? 'Xem hoa hồng' : 'Xem đơn hàng' : 'Xem nguồn giới thiệu'}</a>`),
  };
}

export function profilePanel(ctx) {
  const p = ctx.data.profile;
  if (isMerchant(ctx)) return {
    title: 'Narra Admin', size: 'compact',
    body: detailGrid([['Tài khoản demo', 'Merchant Center'], ['Vai trò', 'Quản trị chương trình'], ['Múi giờ', 'Việt Nam (GMT+7)']]),
    footer: footer(cancel()),
  };
  return {
    title: 'Hồ sơ tài khoản', subtitle: groupName(partnerFor(ctx, PARTNER_ID).group), form: 'profile',
    body: fields(
      entry('Tên hiển thị', 'name', p.name, 'text', 'required maxlength="60"'),
      entry('Email liên hệ', 'email', p.email, 'email', 'maxlength="80"'),
      entry('Ngân hàng nhận tiền', 'bank', p.bank, 'text', 'maxlength="60"'),
      entry('4 số cuối tài khoản', 'bankLast4', p.bankLast4, 'text', 'inputmode="numeric" pattern="[0-9]{4}" maxlength="4"'),
    ) + (p.verification ? note(p.verification) : '')
      + note('Ở bản demo, chỉ cần dùng thông tin mẫu để xem bước xác minh.'),
    footer: footer(cancel(), submit('Lưu thông tin')),
  };
}

export function supportForm(id) {
  return {
    title: 'Gửi yêu cầu hỗ trợ', subtitle: id ? `Đơn ${id}` : '',
    size: 'compact', id, form: 'ticket',
    body: fields(textarea('Nội dung cần hỗ trợ', 'body', id ? `Mình cần đối chiếu đơn ${id}. ` : '', 8)),
    footer: footer(cancel(), submit('Gửi yêu cầu')),
  };
}

export function detailPanel(ctx, type, id) {
  const finders = {
    partner: ['partners', partnerDetail], campaign: ['campaigns', campaignDetail], order: ['orders', orderDetail],
    policy: ['policies', policyDetail], link: ['links', linkDetail], batch: ['batches', batchDetail],
  };
  const entry = finders[type];
  if (!entry) return null;
  const record = ctx.data[entry[0]].find(value => value.id === id);
  const panel = record ? entry[1](ctx, record) : null;
  if (panel && ['partner', 'campaign', 'order', 'batch'].includes(type)) panel.presentation = 'record-drawer';
  return panel;
}

export const choosePreset = key => presets[key];

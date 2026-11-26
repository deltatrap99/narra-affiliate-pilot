import { campaignProgressFor } from './campaign-progress.js';
import { partnerPlans, planLabel, planEarnings } from './partner-mechanism.js';
import { partnerCode } from './partner-profile.js';
import {
  TODAY, GROUPS, PARTNER_ID, date, number, money, percent, addDays, numDays, includesDate, stats,
  earnings, policyAt, campaignStatus, inAudience, commission, orderStatus, earningStatus, holdEnd, batchFor,
} from './model.js';
import {
  icon, esc, matches, statusText, badge, avatar, groupName, groupShort, formatRange, action, route, textLink,
  select, search, empty, table, recordLink, personCell, cardTitle, pageTitle, tabs, note, statIcon, metricCards, filterBar,
  firstName, sum, rate,
} from './ui.js';

const dateSpan = (start, end) => `${date(start, false)} - ${date(end)}`;
const roleMerchant = ctx => ctx.role === 'merchant';
const product = 'Narra Plus';

export const metrics = {
  click: { name: 'Lượt nhấp', icon: 'ads_click', tone: 'violet' },
  l0: { name: 'Đăng ký hợp lệ', icon: 'person_add', tone: 'blue' },
  free: { name: 'Kích hoạt Free', icon: 'bolt', tone: 'green' },
  plus: { name: 'Plus mua mới', icon: 'workspace_premium', tone: 'gold' },
  com: { name: 'Hoa hồng phát sinh', icon: 'payments', tone: 'pink' },
  unique: { name: 'Lượt nhấp riêng biệt', icon: 'ads_click', tone: 'violet' },
};

const statusGroups = {
  pending: ['Chờ xác minh', 'schedule', 'gold'],
  hold: ['Đã duyệt, đang giữ', 'lock', 'violet'],
  payable: ['Đủ điều kiện chi', 'task_alt', 'green'],
  batched: ['Đã vào kỳ', 'calendar_month', 'blue'],
  paid: ['Đã chi trả', 'payments', 'pink'],
};

const campaignBenefit = c => c.kind === 'multiplier' ? `×${number(c.value)} hoa hồng` :
  c.kind === 'fixed' ? `+${money(c.value)} mỗi đơn` : `${percent(c.value)} hoa hồng`;
export { campaignBenefit };

function overviewTitle(ctx) {
  const merchant = roleMerchant(ctx);
  const report = action('Xuất báo cáo', 'export', { symbol: 'download', attributes: 'data-type="overview"' });
  const primary = merchant
    ? action('Tạo chiến dịch', 'new-campaign', { symbol: 'add', type: 'primary' })
    : `<a class="btn btn-primary" href="${route(ctx.role, 'tools')}">${icon('link')} Lấy link giới thiệu</a>`;
  return pageTitle(
    merchant ? 'Tổng quan chương trình' : 'Tổng quan giới thiệu',
    merchant ? 'Theo dõi hiệu quả giới thiệu, doanh thu và các giao dịch cần xử lý.'
      : 'Theo dõi kết quả giới thiệu và hoa hồng trong kỳ bạn chọn.',
    report + primary,
  );
}

function narriWelcome(ctx) {
  const merchant = roleMerchant(ctx);
  const greeting = merchant ? 'Chào bạn, Narri đây!' : `Chào ${firstName(ctx.partners[0]?.name)}, Narri đây!`;
  const encouragement = merchant
    ? 'Nếu hôm nay có nhiều việc, cứ bắt đầu với những đơn cần xác minh rồi quay lại xem chương trình đang tiến triển thế nào nhé.'
    : 'Mỗi lời giới thiệu đều có thể giúp thêm một người tìm được cách luyện nói phù hợp. Hôm nay, bạn thử bắt đầu với một người bạn đang muốn luyện tiếng Anh nhé.';
  return `<section class="narri-welcome" aria-labelledby="narri-greeting">
    <div class="narri-figure"><img src="assets/narri-welcome.webp" width="112" height="102" alt=""></div>
    <div class="narri-message"><h2 id="narri-greeting">${esc(greeting)}</h2><p>${encouragement}</p></div>
  </section>`;
}

function overviewMetrics(current, previous) {
  return `<section class="kpi-stack" aria-label="Chỉ số chính">
    ${['click', 'l0', 'free', 'plus'].map(key => {
      const metric = metrics[key];
      const change = previous[key] ? 100 * (current[key] - previous[key]) / previous[key] : null;
      const growth = change === null ? current[key] ? 'Mới trong kỳ' : '0%' : percent(Math.abs(change));
      return `<button class="report-kpi kpi-${key}" type="button" data-action="metric" data-value="${key}">
        <span class="report-kpi-icon">${icon(metric.icon)}</span>
        <span class="report-kpi-label">${metric.name}</span>
        <strong class="metric-value">${number(current[key])}</strong>
        <span class="report-kpi-change">
          <span class="kpi-delta" aria-label="${change > 0 ? 'Tăng ' : change < 0 ? 'Giảm ' : ''}${growth}">${change ? icon(change > 0 ? 'arrow_upward' : 'arrow_downward') : ''}${growth}</span>
          <span>so với kỳ trước</span>
        </span>
        <canvas class="kpi-spark" aria-hidden="true" data-metric="${key}"></canvas>
      </button>`;
    }).join('')}
  </section>`;
}

function funnel(current) {
  const steps = [['click', 'Lượt nhấp', 'ads_click'], ['l0', 'Đăng ký hợp lệ (L0)', 'person_add'],
    ['free', 'Kích hoạt Free', 'bolt'], ['plus', 'Mua Plus', 'workspace_premium']];
  return `<section class="card funnel-card">${cardTitle('Phễu chuyển đổi', 'Từ lượt nhấp đến đơn Plus.')}
    <div class="funnel">
      ${steps.map(([key, name, symbol], index) => {
        const previous = index === 0 ? current.click : current[steps[index - 1][0]];
        const width = current.click ? Math.max(3, rate(current[key], current.click)) : 0;
        return `<div class="funnel-step step-${index}">
          <div class="funnel-row"><span>${icon(symbol)}${name}</span><strong>${number(current[key])}</strong></div>
          <div class="track" aria-hidden="true"><span style="width:${width}%"></span></div>
          <small>${index ? `${percent(rate(current[key], previous))} từ bước trước` : 'Lượt truy cập ghi nhận'}</small>
        </div>`;
      }).join('')}
    </div>
    <div class="funnel-total"><span>L0 chuyển sang Plus</span><strong>${percent(rate(current.plus, current.l0))}</strong></div>
  </section>`;
}

function trend(ctx, current) {
  const granular = [['day', 'Ngày'], ['week', 'Tuần'], ['month', 'Tháng']];
  return `<section class="card trend-card">${cardTitle('Hiệu quả giới thiệu', 'Ghi nhận theo ngày giới thiệu và ngày thanh toán.',
    `<div class="segmented" aria-label="Độ chi tiết biểu đồ">
      ${granular.map(([value, label]) => `<button type="button" data-action="grain" data-value="${value}" aria-pressed="${ctx.grain === value}" class="${ctx.grain === value ? 'on' : ''}">${label}</button>`).join('')}
    </div>`)}
    <div class="report-summary">
      <a class="report-total" href="${route(ctx.role, 'orders')}">
        ${statIcon('payments', 'violet')}<span>Doanh thu ghi nhận<strong>${money(current.revenue)}</strong></span>
      </a>
      <button type="button" class="report-total" data-action="metric" data-value="com">
        ${statIcon('account_balance_wallet', 'green')}<span>${roleMerchant(ctx) ? 'Hoa hồng phát sinh' : 'Hoa hồng tạm tính'}<strong>${money(current.com)}</strong></span>
      </button>
      <div class="report-total">
        ${statIcon('monitoring', 'blue')}<span>L0 chuyển sang Plus<strong>${percent(rate(current.plus, current.l0))}</strong></span>
      </div>
    </div>
    <div class="chart-area" id="chart-area"><canvas id="trend" tabindex="0" role="img" aria-label="Xu hướng L0, Free và Plus. Dùng phím mũi tên để xem từng mốc."></canvas><div class="chart-tip" id="chart-tip" aria-hidden="true" hidden></div><span class="sr-only" id="chart-readout" role="status"></span></div>
    <div class="legend" aria-label="Chú giải biểu đồ"><span><i class="legend-l0"></i>L0 hợp lệ</span><span><i class="legend-free"></i>Free</span><span><i class="legend-plus"></i>Plus</span></div>
  </section>`;
}

export function buckets(ctx) {
  const { data, ids, range, grain } = ctx;
  const parts = [];
  for (let start = range.start; start <= range.end;) {
    const next = grain === 'month' ? addDays(`${start.slice(0, 7)}-01`, 32).slice(0, 7) + '-01' :
      grain === 'week' ? addDays(start, 7) : addDays(start, 1);
    let end = addDays(next, -1);
    if (end > range.end) end = range.end;
    const label = grain === 'month' ? start.slice(5, 7) + '/' + start.slice(0, 4) : date(start, false);
    parts.push({ label, span: start !== end ? formatRange({ start, end }) : date(start), ...stats(data, ids, { start, end }) });
    start = next;
  }
  return parts;
}

function taskPanel(ctx) {
  const { data, ids } = ctx;
  const pendingOrders = data.orders.filter(o => ids.includes(o.partner) && orderStatus(o) === 'pending').length;
  const pendingPartners = ctx.partners.filter(p => p.status === 'pending').length;
  const pendingBatches = data.batches.filter(b => !b.paidAt && b.entries.some(e => ids.includes(e.partner))).length;
  const tasks = [
    ['orders', 'pending', 'Xác minh đơn hàng', 'shopping_bag', 'violet', pendingOrders, 'đơn chờ xác minh'],
    ['partners', 'pending', 'Duyệt hồ sơ đối tác', 'group', 'blue', pendingPartners, 'hồ sơ mới'],
    ['payouts', 'batches', 'Kiểm tra kỳ đối soát', 'account_balance_wallet', 'green', pendingBatches, 'kỳ chờ xử lý'],
  ];
  return `<section class="card task-panel">${cardTitle('Việc cần xử lý', 'Các mục đang chờ đội vận hành.')}
    ${tasks.map(([page, sub, title, symbol, tone, count, unit]) => `<a class="task" href="${route(ctx.role, page, sub)}">
      ${statIcon(symbol, tone)}<span><strong>${title}</strong><small>${number(count)} ${unit}</small></span>${icon('chevron_right', 'task-arrow')}
    </a>`).join('')}
  </section>`;
}

function ranking(ctx) {
  const leaders = ctx.partners.filter(p => p.status === 'active').map(p => ({ person: p, ...stats(ctx.data, [p.id], ctx.range) }))
    .sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  return `<section class="card">${cardTitle('Đối tác nổi bật', 'Xếp theo doanh thu ghi nhận trong kỳ.', textLink(ctx.role, 'partners', 'Xem đối tác'))}
    ${table(['Đối tác', 'L0 hợp lệ', 'Plus mới', 'Doanh thu'], leaders.map(row => [
      personCell(row.person), number(row.l0), number(row.plus), `<strong>${money(row.revenue)}</strong>`,
    ]), 'Chưa có đối tác phù hợp')}
  </section>`;
}

function earningsPreview(ctx) {
  const totals = earnings(ctx.data, ctx.ids);
  return `<section class="card">${cardTitle('Thu nhập của bạn', `Số dư tính đến ${date(TODAY)}.`, textLink(ctx.role, 'payouts', 'Xem thanh toán'))}
    <div class="balance-list">${['pending', 'hold', 'payable', 'batched', 'paid'].map(key => {
      const [title, symbol, tone] = statusGroups[key];
      return `<div>${statIcon(symbol, tone)}<span>${title}</span><strong>${money(totals[key])}</strong></div>`;
    }).join('')}</div>
  </section>`;
}

function promotion(ctx, campaign) {
  if (!campaign || campaignStatus(campaign) === 'ended' || !policyAt(ctx.data).enabled) return '';
  return `<section class="promo">
    <img class="hero-art" alt="" width="1080" height="720" src="assets/pilot-ribbon.webp">
    <div class="promo-copy"><span class="hero-label">${statusText(campaignStatus(campaign))}</span><h2>${esc(campaign.name)}</h2>
      <p>${esc(campaignBenefit(campaign))} cho đơn Plus đủ điều kiện.</p>
      <span class="promo-date">${icon('calendar_today')}${dateSpan(campaign.start, campaign.end)}</span>
    </div>
    <div class="promo-action">${action('Xem chiến dịch', 'detail', { type: 'lime', attributes: `data-type="campaign" data-id="${esc(campaign.id)}"` })}</div>
  </section>`;
}

export function overview(ctx) {
  const { data, range, ids } = ctx;
  const current = stats(data, ids, range);
  const days = numDays(range.start, range.end);
  const previous = stats(data, ids, { start: addDays(range.start, -days), end: addDays(range.start, -1) });
  return `${overviewTitle(ctx)}${narriWelcome(ctx)}${filterBar(ctx)}
  <div class="report-grid">${overviewMetrics(current, previous)}${trend(ctx, current)}</div>
  ${roleMerchant(ctx)
    ? `<div class="dashboard-grid">${ranking(ctx)}${taskPanel(ctx)}</div>`
    : `<div class="dashboard-grid affiliate-grid">${earningsPreview(ctx)}${promotion(ctx, data.campaigns.find(c => c.id === 'GOLDEN26'))}</div>
      <section class="card">${cardTitle('Đơn hàng gần đây', 'Các giao dịch theo ngày thanh toán.', textLink(ctx.role, 'orders', 'Xem đơn hàng'))}
      ${orderTable(ctx, listOrders(ctx, { status: '', query: '', campaign: '', link: '' }).slice(0, 4))}</section>`}
  ${funnel(current)}`;
}

export function mechanismOverview(ctx) {
  const scheme = ctx.data.mechanism;
  const amountRows = partnerPlans.map(plan => {
    const example = planEarnings(scheme, plan);
    return [esc(planLabel(plan)), money(example.amount), money(example.monthly), money(example.base), money(example.growth), money(example.renewal)];
  });
  return `<section class="card mechanism-card">${cardTitle('Cơ chế đối tác', 'Hoa hồng cho các gói Narra Plus và Family theo số chủ gói mua mới hợp lệ trong tháng.',
      roleMerchant(ctx) ? action('Chỉnh cơ chế', 'edit-mechanism', { symbol: 'edit', type: 'primary' }) : '')}
    <div class="mechanism-rates">
      <div><span>Hoa hồng cơ bản</span><strong>${percent(scheme.base)}</strong></div>
      <div><span>Tăng trưởng</span><strong>${percent(scheme.growth)}</strong></div>
      <div><span>Ngưỡng chủ gói mới</span><strong>${number(scheme.threshold)} <small>/ tháng</small></strong></div>
      <div><span>Gia hạn</span><strong>${percent(scheme.renewal)}</strong></div>
    </div>
    <div class="mechanism-rules">
      <p>${scheme.threshold ? `${number(scheme.threshold)} chủ gói mới hợp lệ đầu tiên trong tháng hưởng ${percent(scheme.base)}. Từ chủ gói thứ ${number(scheme.threshold + 1)}, gói 3, 6 và 12 tháng hưởng ${percent(scheme.growth)}, còn gói 1 tháng hưởng ${percent(scheme.base)}.` :
        `Các gói 3, 6 và 12 tháng hưởng ${percent(scheme.growth)} từ chủ gói mới đầu tiên trong tháng, còn gói 1 tháng hưởng ${percent(scheme.base)}.`}
        Ngưỡng được tính lại vào đầu mỗi tháng.</p>
      <p>Mỗi chủ gói mới Plus hoặc Family được tính một lần. Đơn gia hạn, thành viên Family và đơn hoàn tiền được tách khỏi ngưỡng mua mới. Gia hạn khi đối tác tiếp tục hỗ trợ khách hưởng ${percent(scheme.renewal)}.</p>
      <p><strong>Đề xuất quyền bán mới.</strong> Lần đầu mua gói trả phí của Narra cần có quyền khai thác hợp lệ. Khách cũ đã kết thúc khóa hoặc gói cuối tại GE ít nhất ${number(scheme.returnDays)} ngày và chưa đăng ký mới hoặc gia hạn có thể được xét bán mới theo quy định GE.</p>
    </div>
    ${cardTitle('Thu nhập theo gói và kỳ', 'Mức hoa hồng tính trên số tiền thu một lần của từng gói.')}
    ${table(['Gói & kỳ', 'Thu một lần', 'Quy đổi/tháng', 'HH cơ bản', 'HH tăng trưởng', 'HH gia hạn'], amountRows)}
  </section>`;
}

function policyOverview(ctx) {
  const { data } = ctx;
  const merchant = roleMerchant(ctx);
  const person = data.partners.find(p => p.id === PARTNER_ID);
  const current = policyAt(data);
  const details = [
    ['Ngày hiệu lực', date(current.effective)],
    ['Nhóm áp dụng', merchant ? 'Đại sứ giáo dục và Đại sứ sinh viên' : groupName(person.group)],
    ['Cơ sở tính', 'Giá trị thanh toán đủ điều kiện sau hoàn tiền'],
    ['Cửa sổ ghi nhận', `${number(current.attribution)} ngày tính từ lượt giới thiệu`],
    ['Thời gian giữ', `${number(current.hold)} ngày sau khi duyệt đơn`],
    ['Ngưỡng và lịch chi trả', `${money(current.threshold)} · ${current.cadence}`],
    ['Hoàn tiền', 'Hoa hồng được điều chỉnh theo khoản hoàn, kể cả sau khi đã chi.'],
  ];
  return `<section class="card policy-card">${cardTitle('Điều kiện ghi nhận và chi trả', `Phiên bản ${current.id} áp dụng theo ngày thanh toán.`,
    badge(current.enabled ? 'active' : 'paused'))}
    <dl class="details-grid">${details.map(([key, value]) => `<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
    <div class="card-footer">
      ${merchant ? action('Tạo phiên bản', 'new-policy', { symbol: 'edit', type: 'primary' }) :
        ctx.data.profile.confirmedPolicy === current.id ? badge('approved', 'Bạn đã xác nhận') : action('Xác nhận đã đọc', 'confirm-policy', { symbol: 'check', type: 'primary' })}
    </div>
  </section>
  <section class="card">${cardTitle('Lịch sử điều kiện chi trả', 'Tra cứu các phiên bản đã áp dụng theo thời gian.')}
  ${table(['Phiên bản', 'Hiệu lực từ', 'Yêu cầu giữ', 'Trạng thái'],
    [...data.policies].reverse().map(p => [
      recordLink('policy', p.id), date(p.effective), `${p.hold} ngày`,
      p.id === current.id ? badge('active', 'Đang áp dụng') : badge(p.effective > TODAY ? 'scheduled' : 'ended'),
    ]))}</section>`;
}

export function policyPage(ctx) {
  return `${pageTitle('Cơ chế đối tác', 'Tra cứu quyền lợi, mức hoa hồng và điều kiện chi trả.')}${mechanismOverview(ctx)}${policyOverview(ctx)}`;
}

export function campaignList(ctx) {
  const { data, view, ids, range } = ctx;
  const merchant = roleMerchant(ctx);
  const person = data.partners.find(p => p.id === PARTNER_ID);
  const items = data.campaigns.filter(c => (merchant || (c.state === 'published' || c.state === 'paused') && inAudience(c, person))
    && matches(view.query, c.name, c.id) && (!view.status || campaignStatus(c) === view.status));
  const rows = items.map(c => {
    const allowed = c.members[person.id];
    const totals = stats(data, ids, range, { campaign: c.id });
    const progress = merchant ? null : campaignProgressFor(data, c, person.id);
    return [
      `<div class="item-cell">${statIcon(c.kind === 'multiplier' ? 'workspace_premium' : 'campaign', c.kind === 'multiplier' ? 'gold' : 'violet')}<span>${recordLink('campaign', c.id, c.name)}<small>${esc(c.id)}</small></span></div>`,
      dateSpan(c.start, c.end), `<strong>${esc(campaignBenefit(c))}</strong>`,
      merchant ? esc(groupName(c.group)) : allowed ? badge(allowed, allowed === 'pending' ? 'Chờ duyệt' : 'Đã tham gia') : 'Chưa tham gia',
      merchant ? number(totals.plus) : `${number(progress.counts.orders)} / ${number(c.target)} đơn · ${progress.achieved}/${progress.totalGoals} mốc`,
      badge(campaignStatus(c)), action('Chi tiết', 'detail', { type: 'small', attributes: `data-type="campaign" data-id="${esc(c.id)}"` }),
    ];
  });
  return table(['Chiến dịch', 'Thời gian', 'Quyền lợi', merchant ? 'Đối tượng' : 'Tham gia', merchant ? 'Đơn Plus' : 'Tiến độ', 'Trạng thái', 'Thao tác'], rows, 'Chưa có chiến dịch phù hợp');
}

export function campaigns(ctx) {
  const merchant = roleMerchant(ctx);
  const { data, view } = ctx;
  if (merchant && view.tab === 'program') {
    return `${pageTitle('Chiến dịch', 'Cấu hình chương trình dài hạn và quản lý các chiến dịch theo từng đợt.')}
      ${tabs([['list', 'Chiến dịch ngắn hạn'], ['program', 'Chương trình Affiliate']], 'program')}${mechanismOverview(ctx)}${policyOverview(ctx)}`;
  }
  const rows = merchant ? data.campaigns : data.campaigns.filter(c => c.state !== 'draft' && inAudience(c, data.partners.find(p => p.id === PARTNER_ID)));
  const highlighted = rows.find(c => c.id === 'GOLDEN26');
  return `${pageTitle('Chiến dịch', merchant ? 'Thiết lập ưu đãi, công bố thể lệ và theo dõi kết quả từng chiến dịch.' : 'Xem điều kiện tham gia, quyền lợi và kết quả của bạn trong từng đợt.',
    merchant ? action('Tạo chiến dịch', 'new-campaign', { symbol: 'add', type: 'primary' }) : '')}
    ${merchant ? tabs([['list', 'Chiến dịch ngắn hạn'], ['program', 'Chương trình Affiliate']], 'list') : promotion(ctx, highlighted)}
    ${filterBar(ctx)}
    <section class="card list-card"><div class="toolbar">${select('status', 'Trạng thái chiến dịch', [
      ['', 'Tất cả trạng thái'], ['live', 'Đang diễn ra'], ['scheduled', 'Sắp diễn ra'], ['ended', 'Đã kết thúc'], ['paused', 'Tạm dừng'], ...(merchant ? [['draft', 'Bản nháp']] : []),
    ], view.status)}${search('Tìm chiến dịch', view.query)}</div><div id="results">${campaignList(ctx)}</div></section>`;
}

export function partnerList(ctx) {
  const list = ctx.partners.filter(p => matches(ctx.view.query, partnerCode(p), p.name, groupName(p.group)) && (!ctx.view.status || p.status === ctx.view.status));
  return table(['Đối tác', 'Ngày gửi hồ sơ', 'L0 hợp lệ', 'Đơn Plus', 'Hoa hồng', 'Trạng thái'], list.map(p => {
    const values = stats(ctx.data, [p.id], ctx.range);
    return [personCell(p), date(p.joined), number(values.l0), number(values.plus), `<strong>${money(values.com)}</strong>`,
      badge(p.status, p.status === 'pending' ? 'Chờ duyệt hồ sơ' : undefined)];
  }), 'Chưa có đối tác phù hợp');
}

export function partners(ctx) {
  const list = ctx.partners;
  const onRules = ctx.view.tab === 'mechanism';
  const heading = pageTitle('Đối tác', 'Duyệt hồ sơ, theo dõi hiệu quả giới thiệu và quản lý cơ chế hoa hồng.');
  const onAccess = ctx.portal?.role === 'merchant' && ctx.view.tab === 'access';
  const nav = tabs([['list', 'Hồ sơ đối tác'], ['mechanism', 'Cơ chế đối tác'], ...(ctx.portal?.role === 'merchant' ? [['access', 'Hồ sơ xin mã']] : [])],
    onAccess ? 'access' : onRules ? 'mechanism' : 'list');
  if (onAccess) return heading + nav + '<div id="portal-access" aria-live="polite"><p>Đang tải hồ sơ…</p></div>';
  if (onRules) return heading + nav + mechanismOverview(ctx);
  return `${heading}${nav}
  ${filterBar(ctx)}
  ${metricCards([
    { label: 'Tổng đối tác', value: number(list.length), symbol: 'group' },
    { label: 'Đang hoạt động', value: number(list.filter(p => p.status === 'active').length), symbol: 'task_alt', tone: 'green' },
    { label: 'Chờ duyệt hồ sơ', value: number(list.filter(p => p.status === 'pending').length), symbol: 'schedule', tone: 'gold' },
  ])}
  <section class="card list-card"><div class="toolbar">
    ${select('status', 'Trạng thái đối tác', [['', 'Tất cả trạng thái'], ['active', 'Đang hoạt động'], ['pending', 'Chờ duyệt'], ['paused', 'Tạm dừng'], ['rejected', 'Từ chối']], ctx.view.status)}
    ${search('Tìm theo tên hoặc mã đối tác', ctx.view.query)}
  </div><div id="results">${partnerList(ctx)}</div></section>`;
}

export const linkURL = code => `${window.location.origin}/r?ref=${encodeURIComponent(code)}`;

export function linkList(ctx) {
  const { data, ids, range, view } = ctx;
  const merchant = roleMerchant(ctx);
  const coupon = view.tab === 'coupons';
  const links = data.links.filter(l => ids.includes(l.partner) && (!coupon || l.coupon) && matches(view.query, l.code, l.coupon, l.channel));
  return table([coupon ? 'Mã ưu đãi' : 'Link và mã giới thiệu', ...(merchant ? ['Đối tác'] : []), 'Chiến dịch', 'Lượt nhấp', 'Nhấp riêng biệt', 'Đăng ký (L0)', 'Tỷ lệ L0', 'Trạng thái', 'Thao tác'],
    links.map(l => {
      const p = data.partners.find(p => p.id === l.partner);
      const values = stats(data, [l.partner], range, { link: l.id });
      const c = data.campaigns.find(c => c.id === l.campaign);
      return [
        `<div class="item-cell"><span>${recordLink('link', l.id, coupon ? l.coupon : l.code)}<small>${esc(l.channel)}</small></span></div>`,
        ...(merchant ? [personCell(p)] : []), c ? esc(c.name) : 'Chương trình chung',
        number(values.click), number(values.unique), number(values.l0), percent(rate(values.l0, values.click)),
        badge(l.active && p?.status === 'active' ? 'active' : 'paused', l.active && p?.status === 'active' ? 'Có hiệu lực' : 'Tạm dừng'),
        `<button type="button" class="icon-button table-icon" data-action="copy" data-value="${esc(coupon ? l.coupon : linkURL(l.code))}" aria-label="Sao chép ${esc(coupon ? l.coupon : l.code)}" title="Sao chép">${icon('content_copy')}</button>`,
      ];
    }), coupon ? 'Chưa có mã ưu đãi' : 'Chưa có link phù hợp');
}

function resources() {
  const items = [
    ['campaign', 'Banner chương trình', 'Ảnh dùng cho bài giới thiệu Narra Affiliate.', 'assets/pilot-ribbon.webp', 'narra-affiliate-banner.webp', 'WEBP'],
    ['description', 'Caption giới thiệu Narra', 'Gợi ý bài đăng có thể chỉnh theo kênh của bạn.', 'assets/caption-narra.txt', 'caption-narra.txt', 'TXT'],
    ['receipt_long', 'Hướng dẫn gắn link', 'Các bước kiểm tra nguồn giới thiệu trước khi đăng.', 'assets/huong-dan-link.txt', 'huong-dan-link.txt', 'TXT'],
  ];
  return `<div class="resource-grid">${items.map(([symbol, title, body, url, file, type]) => `<section class="card resource-card">
    ${statIcon(symbol, 'violet')}<h2>${title}</h2><p>${body}</p>
    <a class="btn btn-secondary" href="${url}" download="${file}">${icon('download')} Tải ${type}</a>
  </section>`).join('')}</div>`;
}

export function toolsPage(ctx) {
  const { view, role } = ctx;
  return `${pageTitle('Công cụ quảng bá', roleMerchant(ctx) ? 'Quản lý link, mã giới thiệu và tài nguyên mà Đại sứ dùng để quảng bá Narra.' : 'Lấy link, mã và tài nguyên đã được cấp, sau đó theo dõi hiệu quả của từng kênh.',
    action('Tạo link', 'new-link', { symbol: 'add', type: 'primary' }))}
    ${tabs([['list', 'Link giới thiệu'], ['coupons', 'Mã ưu đãi'], ['resources', 'Tài nguyên']], view.tab)}
    ${view.tab === 'resources' ? resources() : `${filterBar(ctx)}<section class="card list-card"><div class="toolbar">${textLink(role, 'orders', 'Xem chuyển đổi')}${search('Tìm mã hoặc kênh', view.query)}</div><div id="results">${linkList(ctx)}</div></section>`}`;
}

export function listOrders(ctx, view = ctx.view) {
  return ctx.data.orders.filter(o => ctx.ids.includes(o.partner) && includesDate(o.paidAt, ctx.range) &&
    (!view.status || orderStatus(o) === view.status) && (!view.campaign || o.campaign === view.campaign) &&
    (!view.link || o.link === view.link) &&
    matches(view.query, o.id, o.product, ctx.data.partners.find(p => p.id === o.partner)?.name))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.id.localeCompare(a.id));
}

export function orderTable(ctx, rows, paginated = false) {
  const merchant = roleMerchant(ctx);
  return table(['Mã đơn', ...(merchant ? ['Đối tác'] : []), 'Ngày thanh toán', 'Gói', 'Giá trị sau hoàn', 'Hoa hồng', 'Trạng thái'],
    rows.map(o => [
      recordLink('order', o.id), ...(merchant ? [personCell(ctx.data.partners.find(p => p.id === o.partner))] : []),
      date(o.paidAt), esc(o.product), money(o.amount - o.refund), `<strong>${money(commission(o))}</strong>`,
      badge(orderStatus(o), o.conflict && merchant ? 'Xung đột nguồn' : undefined),
    ]), 'Chưa tìm thấy đơn hàng', undefined, paginated ? ctx.view.tablePage ?? 1 : null);
}

export function orders(ctx) {
  const { data, ids, range, view } = ctx;
  const merchant = roleMerchant(ctx);
  const values = stats(data, ids, range);
  const campaigns = data.campaigns.filter(c => merchant || inAudience(c, data.partners.find(p => p.id === PARTNER_ID)) && c.state !== 'draft');
  return `${pageTitle(merchant ? 'Đơn hàng' : 'Hiệu quả giới thiệu',
    merchant ? 'Kiểm tra nguồn giới thiệu, xác nhận giao dịch và theo dõi các khoản hoàn tiền.' : 'Theo dõi lượt giới thiệu và đối chiếu hoa hồng của từng đơn Plus.',
    action('Xuất CSV', 'export', { symbol: 'download', attributes: 'data-type="orders"' }))}
    ${filterBar(ctx)}
    ${metricCards((merchant
      ? [{ label: 'Plus mua mới', value: number(values.plus), symbol: 'shopping_bag' }, { label: 'Doanh thu ghi nhận', value: money(values.revenue), symbol: 'payments', tone: 'green' },
        { label: 'Chờ xác minh', value: number(listOrders(ctx, { status: 'pending' }).length), symbol: 'schedule', tone: 'gold' }]
      : [{ label: 'Nhấp riêng biệt', value: number(values.unique), symbol: 'ads_click' }, { label: 'L0 hợp lệ', value: number(values.l0), symbol: 'person_add', tone: 'blue' },
        { label: 'Kích hoạt Free', value: number(values.free), symbol: 'bolt', tone: 'green' }, { label: 'Plus mua mới', value: number(values.plus), symbol: 'workspace_premium', tone: 'gold' },
        { label: 'Tỷ lệ L0 thành Plus', value: percent(rate(values.plus, values.l0)), symbol: 'monitoring', tone: 'pink' }]))}
    <section class="card list-card"><div class="toolbar"><div class="toolbar-left">
      ${select('status', 'Trạng thái đơn', [['', 'Tất cả trạng thái'], ['pending', 'Chờ xác minh'], ['approved', 'Đã xác nhận'], ['partial', 'Hoàn một phần'], ['refunded', 'Đã hoàn tiền'], ['rejected', 'Từ chối']], view.status)}
      ${select('campaign', 'Chiến dịch', [['', 'Tất cả chiến dịch'], ...campaigns.map(c => [c.id, c.name])], view.campaign)}
      ${select('link', 'Nguồn giới thiệu', [['', 'Tất cả nguồn'], ...data.links.filter(l => ids.includes(l.partner)).map(l => [l.id, l.code])], view.link)}
      </div>${search('Tìm mã đơn hàng', view.query)}</div><div id="results">${orderTable(ctx, listOrders(ctx), true)}</div></section>`;
}

export function listEarnings(ctx) {
  return ctx.data.orders.filter(o => ctx.ids.includes(o.partner) && includesDate(o.paidAt, ctx.range) &&
    (!ctx.view.status || earningStatus(ctx.data, o) === ctx.view.status) && matches(ctx.view.query, o.id, batchFor(ctx.data, o.id)?.id))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.id.localeCompare(a.id));
}

export function payoutList(ctx) {
  const { data, ids, range, view } = ctx;
  const merchant = roleMerchant(ctx);
  if (view.tab === 'batches') {
    const items = data.batches.filter(b => b.entries.some(e => ids.includes(e.partner)) &&
      includesDate(b.paidAt || b.created, range) && matches(view.query, b.id, b.name, b.ref));
    return table(['Kỳ đối soát', 'Ngày lập', 'Ngày chi', 'Số khoản', 'Số tiền', 'Trạng thái', 'Bảng kê'], items.map(b => {
      const entries = b.entries.filter(e => ids.includes(e.partner));
      return [recordLink('batch', b.id, b.name), date(b.created), b.paidAt ? date(b.paidAt) : 'Chưa chi',
        number(entries.length), `<strong>${money(sum(entries))}</strong>`, badge(b.paidAt ? 'paid' : 'batched'),
        action('Tải CSV', 'export', { type: 'small', symbol: 'download', attributes: `data-type="batch" data-id="${b.id}"` }),
      ];
    }), 'Chưa có kỳ đối soát trong khoảng đã chọn');
  }
  const rows = listEarnings(ctx);
  return table(['Mã đơn', ...(merchant ? ['Đối tác'] : []), 'Ngày thanh toán', 'Ngày hết giữ', 'Hoa hồng', 'Kỳ đối soát', 'Trạng thái'], rows.map(o => {
    const batch = batchFor(data, o.id);
    return [
      recordLink('order', o.id), ...(merchant ? [personCell(data.partners.find(p => p.id === o.partner))] : []),
      date(o.paidAt), date(holdEnd(o)), `<strong>${money(commission(o))}</strong>`,
      batch ? recordLink('batch', batch.id) : 'Chưa vào kỳ', badge(earningStatus(data, o)),
    ];
  }), 'Chưa có khoản hoa hồng phù hợp', undefined, view.tablePage ?? 1);
}

export function payouts(ctx) {
  const { data, ids, view, range } = ctx;
  const merchant = roleMerchant(ctx);
  const total = earnings(data, ids);
  const inPeriod = stats(data, ids, range);
  const paidInPeriod = data.batches.filter(b => includesDate(b.paidAt, range)).reduce((amount, b) => amount + sum(b.entries.filter(e => ids.includes(e.partner))), 0);
  const adjust = data.adjustments.filter(a => ids.includes(a.partner) && includesDate(a.at, range));
  return `${pageTitle(merchant ? 'Hoa hồng & chi trả' : 'Thu nhập & thanh toán',
    merchant ? 'Đối soát từng khoản với đơn hàng gốc và ghi nhận các kỳ chi trả.' : 'Kiểm tra hoa hồng theo từng đơn, ngày đủ điều kiện chi và bảng kê thanh toán.',
    merchant ? action('Lập kỳ đối soát', 'new-batch', { symbol: 'add', type: 'primary' }) : action('Thông tin nhận tiền', 'profile', { symbol: 'payments' }))}
    ${filterBar(ctx)}
    ${metricCards(Object.entries(statusGroups).map(([key, [label, symbol, tone]]) => ({
      label, value: money(total[key]), symbol, tone, foot: `Số dư đến ${date(TODAY, false)}`,
      detail: 'earning-filter', metric: key,
    })))}
    <div class="period-note"><span><strong>${money(inPeriod.com)}</strong> hoa hồng theo ngày thanh toán đơn</span><span><strong>${money(paidInPeriod)}</strong> thực chi theo ngày chuyển tiền</span></div>
    ${tabs([['list', 'Hoa hồng theo đơn'], ['batches', 'Kỳ đối soát'], ['adjustments', 'Điều chỉnh']], view.tab)}
    ${view.tab === 'adjustments'
      ? `<section class="card">${cardTitle('Điều chỉnh sau chi trả', 'Khoản thu hồi được cấn trừ ở kỳ đủ điều kiện tiếp theo.')}
        ${table(['Mã đơn', 'Ngày ghi nhận', 'Lý do', 'Số tiền', 'Kỳ đối soát'], adjust.map(a => [
          recordLink('order', a.orderId), date(a.at), esc(a.reason), `<strong class="negative">${money(a.amount)}</strong>`,
          a.batch ? recordLink('batch', a.batch) : 'Chờ vào kỳ',
        ]), 'Chưa có điều chỉnh trong kỳ', '')}</section>`
      : `<section class="card list-card"><div class="toolbar">
          ${view.tab === 'list' ? select('status', 'Trạng thái hoa hồng', [['', 'Tất cả trạng thái'], ...Object.entries(statusGroups).map(([key, [label]]) => [key, label]), ['refunded', 'Đã hoàn tiền'], ['rejected', 'Từ chối']], view.status)
            : action('Xuất bảng kê', 'export', { symbol: 'download', attributes: 'data-type="payouts"' })}
          ${search(view.tab === 'batches' ? 'Tìm kỳ hoặc mã tham chiếu' : 'Tìm mã đơn hoặc kỳ đối soát', view.query)}
        </div><div id="results">${payoutList(ctx)}</div></section>`}`;
}

export function supportPage(ctx) {
  const merchant = roleMerchant(ctx);
  const list = ctx.data.tickets.filter(t => merchant || t.partner === PARTNER_ID);
  return `${pageTitle('Hỗ trợ', 'Theo dõi yêu cầu liên quan đến quyền lợi, đơn hàng và chi trả.',
    action('Gửi yêu cầu', 'new-ticket', { type: 'primary', symbol: 'add' }))}
    <section class="card">${cardTitle('Yêu cầu hỗ trợ', 'Yêu cầu hỗ trợ được lưu trên thiết bị này.')}
    ${table(['Mã yêu cầu', 'Nội dung', 'Ngày gửi', 'Trạng thái'], list.map(t => [
      esc(t.id), `<span class="long-cell">${esc(t.body)}</span>`, date(t.at), badge('open'),
    ]), 'Chưa có yêu cầu hỗ trợ', 'Khi cần làm rõ một giao dịch, bạn có thể gửi mã đơn để đội vận hành đối chiếu.')}</section>`;
}

export function systemPage(ctx) {
  const tab = ctx.view.tab;
  const items = [['list', 'Nhật ký'], ['team', 'Đội ngũ'], ['email', 'Email'], ['api', 'API']];
  const content = tab === 'team'
    ? table(['Thành viên', 'Vai trò', 'Quyền truy cập'], [[personCell({ name: 'Narra Admin', group: '', id: 'Merchant Center', tone: 'violet' }, false), 'Quản trị chương trình', 'Quản lý chiến dịch, đối tác, đơn hàng và đối soát']])
    : tab === 'email'
      ? note('Các cập nhật chiến dịch xuất hiện trong mục thông báo. Gửi email sẽ cần cấu hình kênh của chương trình.', 'email')
      : tab === 'api'
        ? note('API REFLO và luồng sự kiện Narra chưa được kết nối.', 'lock')
        : table(['Ngày', 'Hoạt động'], ctx.data.audit.map(e => [date(e.at), esc(e.text)]), 'Chưa có hoạt động vận hành', 'Các thay đổi về chiến dịch, hồ sơ, đơn hàng và kỳ chi trả sẽ xuất hiện tại đây.');
  return `${pageTitle('Quản trị hệ thống', 'Theo dõi thay đổi và các công cụ vận hành chung của chương trình.')}
    ${tabs(items, tab)}<section class="card system-card">${cardTitle(items.find(([key]) => key === tab)?.[1] ?? 'Nhật ký')}${content}</section>`;
}

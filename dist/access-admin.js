import { action, badge, cardTitle, esc, optionList, table } from './ui.js';
import { GROUPS } from './model.js';
import { safeAvatar } from './partner-profile.js';

const requestDate = value => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
}).format(new Date(value * 1000));

export function accessLists(applications, resets) {
  return `<section class="card">${cardTitle('Hồ sơ xin cấp mã', 'Duyệt hồ sơ đối tác và cấp quyền đăng nhập.')}
    ${table(['Đối tác', 'Mã đối tác', 'Liên hệ', 'Thời điểm gửi', 'Trạng thái', 'Hồ sơ'], applications.map(item => [
      esc(item.name), esc(item.code), `${esc(item.email)}<br>${esc(item.phone)}`, requestDate(item.createdAt),
      badge(item.status, item.status === 'pending' ? 'Chờ duyệt' : item.status === 'approved' ? 'Đã cấp mã' : 'Đã từ chối'),
      action('Xem hồ sơ', 'access-application', { type: 'small', attributes: `data-id="${esc(item.id)}"` }),
    ]), 'Chưa có hồ sơ xin mã', 'Hồ sơ từ trang đăng ký sẽ xuất hiện ở đây.')}</section>
    <section class="card">${cardTitle('Yêu cầu đặt lại mật khẩu', 'Cấp link đặt lại cho đối tác đã gửi yêu cầu.')}
    ${table(['Đối tác', 'Mã đối tác', 'Email', 'Thời điểm gửi', 'Thao tác'], resets.map(item => [
      esc(item.name), esc(item.code), esc(item.email), requestDate(item.requestedAt),
      action('Cấp link đặt lại', 'access-reset', { type: 'small', attributes: `data-id="${esc(item.id)}"` }),
    ]), 'Chưa có yêu cầu đặt lại mật khẩu', 'Yêu cầu từ mục Quên mật khẩu sẽ xuất hiện ở đây.')}</section>`;
}

export function applicationPanel(record) {
  const { id, name, code, status } = record;
  const photo = safeAvatar(record.avatar);
  const details = [
    ['Mã đối tác', code], ['Email', record.email], ['Số điện thoại chính', record.phone], ['Số điện thoại khác', record.phone2],
    ['Giới tính', record.gender], ['Ngày sinh', record.birth], ['Số CMT/CCCD', record.nationalId],
    ['Tỉnh/thành phố', record.province], ['Nghề nghiệp', record.occupation], ['Mã đại sứ giới thiệu', record.referrer],
    ['Đồng ý điều khoản', record.consentAt ? requestDate(Date.parse(record.consentAt) / 1000) : 'Chưa có'],
  ];
  return {
    title: name, subtitle: 'Hồ sơ xin cấp mã đối tác', size: 'wide',
    body: `<div class="person-cell">${photo ? `<span class="avatar large" aria-hidden="true"><img src="${photo}" alt=""></span>` : ''}
      ${badge(status, status === 'pending' ? 'Chờ duyệt' : status === 'approved' ? 'Đã cấp mã' : 'Đã từ chối')}</div>
      <dl class="details-grid">${details.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value || 'Chưa có')}</dd></div>`).join('')}</dl>
      ${status === 'pending' ? `<label class="field"><span>Nhóm đối tác</span><select name="application-group">${optionList(Object.entries(GROUPS), record.group)}</select></label>` : ''}`,
    footer: action('Đóng', 'close-dialog') + (status === 'pending'
      ? action('Từ chối', 'access-review', { type: 'danger', attributes: `data-id="${esc(id)}" data-value="reject"` })
        + action('Duyệt và cấp mã', 'access-review', { type: 'primary', attributes: `data-id="${esc(id)}" data-value="approve"` })
      : ''),
  };
}

export function recoveryLinkPanel(url) {
  return {
    title: 'Link đặt lại mật khẩu', size: 'compact',
    body: `<p>Link có hiệu lực trong 60 phút và dùng một lần. Bạn có thể sao chép để gửi cho đối tác đã yêu cầu.</p><div class="link-box">${esc(url)}</div>`,
    footer: action('Đóng', 'close-dialog') +
      action('Sao chép link', 'copy', { type: 'primary', symbol: 'content_copy', attributes: `data-value="${esc(url)}"` }),
  };
}

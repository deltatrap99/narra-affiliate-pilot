import { portalRequest } from './portal-api.js';
import { prepareAvatar } from './partner-profile.js';

const registry = {
  '/': 'login', '/quan-tri': 'merchant', '/xin-cap-ma': 'apply', '/quen-mat-khau': 'recover',
};
const app = document.querySelector('.portal-layout');
const form = document.querySelector('[data-access-form="apply"]');
const resume = document.querySelector('#resume-session');
const resultTitle = document.querySelector('#result-title');
const resultCopy = document.querySelector('#result-copy');
const resultCode = document.querySelector('#result-code');
const reference = document.querySelector('#result-reference');
let avatarUrl = '';

function show(panel, focus = false) {
  for (const view of document.querySelectorAll('[data-panel]')) {
    view.hidden = view.dataset.panel !== panel;
    if (focus && !view.hidden) view.querySelector('h2').focus({ preventScroll: true });
  }
  app.classList.toggle('is-register', panel === 'apply');
}

const hash = () => location.hash.slice(1) || '/';
function drawRoute(focus = false) {
  const route = hash();
  show(registry[route] ?? (route.startsWith('/dat-lai/') ? 'reset' : 'login'), focus);
  if (focus) document.querySelector('#entry').scrollIntoView({ block: 'nearest' });
}
window.addEventListener('hashchange', () => drawRoute(true));
drawRoute();
portalRequest('/api/session').then(data => { resume.hidden = !data.session; }).catch(() => {});

function success(title, message, code = '') {
  resultTitle.textContent = title;
  resultCopy.textContent = message;
  resultCode.textContent = code;
  reference.hidden = !code;
  if (hash().startsWith('/dat-lai/')) history.replaceState(null, '', '/');
  show('result', true);
  document.querySelector('#entry').scrollIntoView({ block: 'nearest' });
}

const photo = form.elements.photo;
function clearPhoto() {
  if (avatarUrl) URL.revokeObjectURL(avatarUrl);
  avatarUrl = '';
  document.querySelector('#apply-preview').hidden = true;
}
photo.addEventListener('change', () => {
  clearPhoto();
  if (!photo.files[0]) return;
  avatarUrl = URL.createObjectURL(photo.files[0]);
  const preview = document.querySelector('#apply-preview');
  preview.src = avatarUrl;
  preview.hidden = false;
});
window.addEventListener('pagehide', clearPhoto);

document.addEventListener('click', event => {
  const toggle = event.target.closest('[data-password]');
  if (!toggle) return;
  const input = document.getElementById(toggle.dataset.password);
  input.type = input.type === 'password' ? 'text' : 'password';
  toggle.textContent = input.type === 'password' ? 'Hiện' : 'Ẩn';
  toggle.setAttribute('aria-pressed', String(input.type === 'text'));
});

document.addEventListener('submit', async event => {
  const current = event.target.closest('[data-access-form]');
  if (!current) return;
  event.preventDefault();
  if (current.dataset.busy) return;
  const flow = current.dataset.accessForm;
  const input = Object.fromEntries([...new FormData(current)].filter(([, value]) => typeof value === 'string'));
  const error = current.querySelector('.entry-error');
  let leaving = false;
  const submit = current.querySelector('button[type="submit"]');
  error.hidden = true;
  current.dataset.busy = 'true';
  submit.disabled = true;
  try {
    if (flow === 'apply') {
      input.consent = current.elements.consent.checked;
      if (input.password !== input.confirmPassword) throw new Error('Hai mật khẩu chưa khớp.');
      const file = photo.files[0];
      if (file) input.avatar = await prepareAvatar(file, { maxBytes: 3_100_000, allowGif: true });
    }
    if (flow === 'reset') {
      input.token = hash().split('/')[2] ?? '';
      if (input.password !== input.confirmPassword) throw new Error('Hai mật khẩu chưa khớp.');
    }
    const response = await portalRequest('/api/auth/' + flow, input);
    current.reset();
    if (flow === 'merchant' || flow === 'login') {
      leaving = true;
      location.assign('/portal#/' + response.role + '/overview');
    } else if (flow === 'apply') {
      clearPhoto();
      success('Đã gửi yêu cầu cấp mã', 'Lưu mã bên dưới. Sau khi hồ sơ được duyệt, bạn dùng mã này cùng mật khẩu đã tạo để đăng nhập.', response.code);
    } else if (flow === 'recover') {
      success('Đã tiếp nhận yêu cầu', 'Khi mã đối tác và email khớp với hồ sơ, Quản trị viên có thể cấp link đặt lại mật khẩu cho bạn.');
    } else {
      success('Đã lưu mật khẩu mới', 'Bạn có thể dùng mã đối tác và mật khẩu mới để đăng nhập.');
    }
  } catch (reason) {
    error.textContent = reason.message || 'Chưa thể xử lý yêu cầu. Vui lòng thử lại.';
    error.hidden = false;
  } finally {
    if (!leaving) {
      delete current.dataset.busy;
      submit.disabled = false;
    }
  }
});

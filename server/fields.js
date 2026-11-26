import { bad } from './security.js';

export const TERMS_URL = 'https://ge-policies.vercel.app/ams';

function field(data, key, label, limit, required = false) {
  const value = typeof data[key] === 'string' ? data[key].trim() : '';
  if ((required && !value) || value.length > limit) throw bad('Kiểm tra lại ' + label + '.');
  return value;
}

export function codeField(data) {
  const value = field(data, 'code', 'mã đối tác', 32, true).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(value)) throw bad('Kiểm tra lại mã đối tác.');
  return value;
}
export function emailField(data) {
  const value = field(data, 'email', 'địa chỉ email', 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw bad('Kiểm tra lại địa chỉ email.');
  return value;
}
function phoneField(data, key, required = false) {
  const value = field(data, key, 'số điện thoại', 24, required);
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (!/^\+?[\d().\s-]+$/.test(value) || digits.length < 8 || digits.length > 15) throw bad('Kiểm tra lại số điện thoại.');
  return (value.startsWith('+') ? '+' : '') + digits;
}
export function passwordField(data, confirm = true) {
  const value = data.password;
  if (typeof value !== 'string' || value.length < 10 || value.length > 128) throw bad('Mật khẩu cần từ 10 đến 128 ký tự.');
  if (confirm && value !== data.confirmPassword) throw bad('Hai mật khẩu chưa khớp.');
  return value;
}
function avatarField(data) {
  const source = field(data, 'avatar', 'ảnh đại diện', 180_000);
  if (source && !/^data:image\/(?:webp|jpeg|png);base64,[a-z\d+/]+={0,2}$/i.test(source)) throw bad('Kiểm tra lại ảnh đại diện.');
  return source;
}

export function applicationFields(data) {
  if (data.consent !== true) throw bad('Hãy xác nhận đã đồng ý với điều khoản dịch vụ.');
  const surname = field(data, 'surname', 'họ', 50, true);
  const givenName = field(data, 'givenName', 'tên', 65, true);
  const birth = field(data, 'birth', 'ngày sinh', 10, true);
  const birthDate = new Date(birth);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !Number.isFinite(+birthDate) || birthDate.toISOString().slice(0, 10) !== birth || birth > today) throw bad('Kiểm tra lại ngày sinh.');
  const nationalId = field(data, 'nationalId', 'số CMT/CCCD', 16, true).replace(/\s/g, '');
  if (!/^(?:\d{9}|\d{12})$/.test(nationalId)) throw bad('Số CMT/CCCD cần có 9 hoặc 12 chữ số.');
  const gender = field(data, 'gender', 'giới tính', 32, true);
  if (!['Nam', 'Nữ', 'Khác', 'Không muốn cung cấp'].includes(gender)) throw bad('Kiểm tra lại thông tin hồ sơ.');
  const referrer = field(data, 'referrer', 'mã đại sứ giới thiệu', 32);
  return {
    name: surname + ' ' + givenName, email: emailField(data), phone: phoneField(data, 'phone', true),
    phone2: phoneField(data, 'phone2'), gender, birth, nationalId, referrer,
    province: field(data, 'province', 'tỉnh/thành phố', 70, true),
    occupation: field(data, 'occupation', 'nghề nghiệp', 80),
    avatar: avatarField(data), group: 'DSGD', termsUrl: TERMS_URL, consentAt: new Date().toISOString(),
  };
}

export function editableFields(data) {
  const bank = field(data, 'bank', 'tên ngân hàng', 60);
  const bankAccount = field(data, 'bankAccount', 'số tài khoản ngân hàng', 30).replace(/\s/g, '');
  if (bankAccount && (!bank || !/^\d+$/.test(bankAccount))) throw bad('Kiểm tra lại ngân hàng và số tài khoản nhận tiền.');
  return {
    name: field(data, 'name', 'tên hiển thị', 60, true),
    email: emailField(data), phone: phoneField(data, 'phone', true), bank, bankAccount,
    bankLast4: bankAccount.slice(-4), ...(Object.hasOwn(data, 'avatar') ? { avatar: avatarField(data) } : {}),
  };
}

export const partnerCode = partner => partner.code || partner.id;
const avatarTypes = ['image/jpeg', 'image/png', 'image/webp'];
const avatarPattern = /^data:image\/(?:webp|jpeg|png);base64,[a-z\d+/]+={0,2}$/i;

export const safeAvatar = source => typeof source === 'string' && source.length <= 180_000 && avatarPattern.test(source) ? source : '';

export function profileFields(partners, current, fields, isAdmin) {
  const { name, email, phone, bank, bankAccount } = fields;
  if (!name) throw new Error('Nhập tên hiển thị của đối tác.');
  const code = isAdmin ? fields.code?.toUpperCase() : partnerCode(current);
  if (!code || !/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code)) throw new Error('Mã đối tác cần từ 2 đến 32 ký tự, gồm chữ, số, gạch nối hoặc gạch dưới.');
  if (partners.some(partner => partner.id !== current.id && partnerCode(partner).toUpperCase() === code)) throw new Error('Mã đối tác này đã được sử dụng.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Kiểm tra lại địa chỉ email.');
  const phoneDigits = phone.replace(/\D/g, '');
  if (phone && (!/^\+?[\d ().-]+$/.test(phone) || phoneDigits.length < 8 || phoneDigits.length > 15)) throw new Error('Kiểm tra lại số điện thoại.');
  const account = bankAccount.replace(/\s/g, '');
  if (account && !/^\d{1,30}$/.test(account)) throw new Error('Số tài khoản ngân hàng chỉ gồm chữ số.');
  if (account && !bank) throw new Error('Nhập tên ngân hàng nhận tiền.');
  const bankChanged = bank !== (current.bank || '') || account !== (current.bankAccount || '');
  return {
    name, code, email, phone, bank, bankAccount: account,
    bankLast4: bankChanged ? account.slice(-4) : current.bankLast4 || account.slice(-4),
    verification: bankChanged ? Boolean(bank && account) : Boolean(current.verification),
  };
}

export async function prepareAvatar(file) {
  if (!avatarTypes.includes(file.type)) throw new Error('Chọn ảnh JPG, PNG hoặc WebP.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Chọn ảnh có dung lượng tối đa 8 MB.');
  const url = URL.createObjectURL(file);
  try {
    const picture = new Image();
    picture.src = url;
    await picture.decode();
    const size = Math.min(picture.naturalWidth, picture.naturalHeight);
    if (!size) throw new Error();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(size, 256);
    canvas.getContext('2d').drawImage(picture, (picture.naturalWidth - size) / 2, (picture.naturalHeight - size) / 2, size, size,
      0, 0, canvas.width, canvas.height);
    let encoded = canvas.toDataURL('image/webp', .86);
    if (!safeAvatar(encoded)) encoded = canvas.toDataURL('image/jpeg', .8);
    if (!safeAvatar(encoded)) throw new Error();
    return encoded;
  } catch {
    throw new Error('Ảnh này chưa thể dùng làm ảnh đại diện. Thử chọn ảnh khác.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

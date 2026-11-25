export const partnerPlans = [
  { id: 'plus-1', product: 'Narra Plus', months: 1, price: 119000 },
  { id: 'plus-3', product: 'Narra Plus', months: 3, price: 357000 },
  { id: 'plus-6', product: 'Narra Plus', months: 6, price: 678300 },
  { id: 'plus-12', product: 'Narra Plus', months: 12, price: 1188000 },
  { id: 'family-1', product: 'Narra Family', months: 1, price: 319000 },
  { id: 'family-3', product: 'Narra Family', months: 3, price: 957000 },
  { id: 'family-6', product: 'Narra Family', months: 6, price: 1818300 },
  { id: 'family-12', product: 'Narra Family', months: 12, price: 3062400 },
];

export const mechanismFields = [
  ['base', 'Hoa hồng cơ bản (%)', 'required min="0" max="100" step="0.1"'],
  ['growth', 'Hoa hồng tăng trưởng (%)', 'required min="0" max="100" step="0.1"'],
  ['threshold', 'Ngưỡng chủ gói mới mỗi tháng', 'required min="0" step="1"'],
  ['renewal', 'Hoa hồng gia hạn (%)', 'required min="0" max="100" step="0.1"'],
  ['returnDays', 'Số ngày xem xét bán mới cho khách cũ', 'required min="1" step="1"'],
];

export const defaultMechanism = () => ({
  revision: 1,
  base: 25, growth: 30, threshold: 10, renewal: 10, returnDays: 365,
  prices: Object.fromEntries(partnerPlans.map(plan => [plan.id, plan.price])),
});

export const planLabel = plan => `${plan.product} / ${plan.months} tháng`;

export function planEarnings(mechanism, plan) {
  const amount = mechanism.prices[plan.id];
  return {
    amount,
    monthly: Math.round(amount / plan.months),
    base: Math.round(amount * mechanism.base / 100),
    growth: Math.round(amount * (plan.months === 1 ? mechanism.base : mechanism.growth) / 100),
    renewal: Math.round(amount * mechanism.renewal / 100),
  };
}

export function readMechanismFields(fields, current) {
  const value = (key, label, valid) => {
    const number = Number(fields[key]);
    if (!fields[key] || !Number.isFinite(number) || !valid(number)) throw new Error(`Kiểm tra lại giá trị “${label}”.`);
    return number;
  };
  const isRate = number => number >= 0 && number <= 100 && Math.abs(number * 10 - Math.round(number * 10)) < 1e-8;
  const count = (number, min) => Number.isSafeInteger(number) && number >= min;
  const base = value('base', 'Hoa hồng cơ bản', isRate);
  const growth = value('growth', 'Hoa hồng tăng trưởng', isRate);
  if (growth < base) throw new Error('Hoa hồng tăng trưởng cần từ mức cơ bản trở lên.');
  return {
    revision: current.revision + 1,
    base, growth,
    threshold: value('threshold', 'Ngưỡng chủ gói mới', n => count(n, 0)),
    renewal: value('renewal', 'Hoa hồng gia hạn', isRate),
    returnDays: value('returnDays', 'Số ngày xem xét bán mới', n => count(n, 1)),
    prices: Object.fromEntries(partnerPlans.map(plan => [plan.id, value(plan.id, planLabel(plan), n => count(n, 1))])),
  };
}

export function commissionTerms(mechanism) {
  const { revision, base, growth, threshold, renewal } = mechanism;
  return { revision, base, growth, threshold, renewal };
}

export function partnerOrderRate(orders, order) {
  const { terms, months, purchase, owner, paidAt, partner } = order;
  if (purchase === 'renewal') return terms.renewal;
  if (months === 1) return terms.base;
  const month = paidAt.slice(0, 7);
  const owners = new Set(orders
    .filter(row => row.id !== order.id && row.partner === partner && row.paidAt.startsWith(month) &&
      row.status === 'approved' && !row.refund && row.purchase === 'new' && row.owner)
    .map(row => row.owner));
  if (owners.has(owner)) return terms.base;
  return owners.size >= terms.threshold ? terms.growth : terms.base;
}

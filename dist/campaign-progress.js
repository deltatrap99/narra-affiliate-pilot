import { includesDate, money, number } from './model.js';

export const goalTypes = [
  { id: 'l0', label: 'Đăng ký hợp lệ', unit: 'đăng ký', icon: 'person_add', tone: 'blue' },
  { id: 'free', label: 'Kích hoạt Free', unit: 'lượt kích hoạt', icon: 'bolt', tone: 'green' },
  { id: 'orders', label: 'Đơn đủ điều kiện', unit: 'đơn', icon: 'shopping_bag', tone: 'violet' },
  { id: 'revenue', label: 'Doanh thu đủ điều kiện', unit: '', icon: 'payments', tone: 'gold' },
];

export const goalValue = (item, value) => item.id === 'revenue' ? money(value) : number(value);
export const goalAmount = (item, value) => item.id === 'revenue' ? money(value) : `${number(value)} ${item.unit}`;

export function goalTarget(campaign, id) {
  return campaign.goals?.[id] ?? (id === 'orders' ? campaign.target : 0);
}

export function readCampaignGoals(fields) {
  return Object.fromEntries(goalTypes.map(item => {
    const value = Number(fields[item.id] || 0);
    if (!Number.isSafeInteger(value) || value < (item.id === 'orders' ? 1 : 0)) {
      throw new Error(`Nhập mục tiêu hợp lệ cho hạng mục “${item.label}”.`);
    }
    return [item.id, value];
  }));
}

export function campaignProgressFor(data, campaign, partner) {
  const active = campaign.members[partner] === 'joined';
  const range = { start: campaign.start, end: campaign.end };
  const counts = { l0: 0, free: 0, orders: 0, revenue: 0 };
  let pending = 0;
  if (active) {
    for (const event of data.activity) {
      if (event.partner !== partner || event.campaign !== campaign.id || !includesDate(event.at, range)) continue;
      counts.l0 += event.l0;
      counts.free += event.free;
    }
    for (const order of data.orders) {
      if (order.partner !== partner || order.campaign !== campaign.id || order.product !== campaign.eligibleProduct ||
        !includesDate(order.paidAt, range) || order.purchase === 'renewal' || order.refund >= order.amount) continue;
      if (order.status === 'approved') {
        counts.orders++;
        counts.revenue += order.amount - order.refund;
      } else if (order.status === 'pending') {
        pending++;
      }
    }
  }
  const items = goalTypes.map(item => {
    const target = goalTarget(campaign, item.id);
    const current = counts[item.id];
    return { ...item, target, current, left: Math.max(0, target - current) };
  });
  const set = items.filter(item => item.target > 0);
  return { items, counts, pending, totalGoals: set.length, achieved: set.filter(item => item.left === 0).length };
}

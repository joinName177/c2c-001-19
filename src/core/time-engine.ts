import type { CategoryMetric, InvestmentRecord, TimeAccount, TimeCategory, InvestmentTag } from './models';
import { CATEGORIES, CATEGORY_META, DEFAULT_TAG, TAGS, TAG_META } from './models';

export function totalInvested(records: InvestmentRecord[]): number {
  return records.reduce((sum, item) => sum + item.hours, 0);
}

export function metricsFor(records: InvestmentRecord[]): CategoryMetric[] {
  const total = totalInvested(records);
  return CATEGORIES.map((category) => {
    const hours = records.filter((item) => item.category === category).reduce((sum, item) => sum + item.hours, 0);
    const meta = CATEGORY_META[category];
    return { category, hours, share: total ? hours / total : 0, roi: meta.roi, color: meta.color, icon: meta.icon };
  });
}

export function portfolioScore(metrics: CategoryMetric[], account: TimeAccount): number {
  const invested = metrics.reduce((sum, item) => sum + item.hours * item.roi, 0);
  const available = Math.max(account.weeklyHours, 1);
  return Math.round((invested / available) * 10) / 10;
}

export function balanceSheet(metrics: CategoryMetric[], account: TimeAccount) {
  const assets = metrics.reduce((sum, item) => sum + item.hours * item.roi, 0);
  const invested = metrics.reduce((sum, item) => sum + item.hours, 0);
  return { assets: Math.round(assets * 10) / 10, liabilities: Math.max(0, Math.round((account.weeklyHours - invested) * 10) / 10), equity: Math.round((assets - Math.max(0, account.weeklyHours - invested)) * 10) / 10 };
}

export function suggestions(metrics: CategoryMetric[], account: TimeAccount): string[] {
  const total = Math.max(metrics.reduce((sum, item) => sum + item.hours, 0), 1);
  const lowest = [...metrics].sort((a, b) => a.hours - b.hours)[0];
  const highest = [...metrics].sort((a, b) => b.hours - a.hours)[0];
  const result: string[] = [];
  if (highest.share > 0.35) result.push(`「${highest.category}」占比 ${Math.round(highest.share * 100)}%，建议每周拿出 2 小时投向低配资产。`);
  if (lowest.share < 0.1) result.push(`「${lowest.category}」只有 ${Math.round(lowest.share * 100)}%，这是当前最值得补仓的长期资产。`);
  if (account.weeklyHours - total > 4) result.push(`还有 ${Math.round(account.weeklyHours - total)} 小时未被配置，可以先建立一笔“探索基金”。`);
  if (!result.length) result.push('你的时间组合分布稳定，继续用每周复盘保持动态平衡。');
  return result;
}

export interface TagMetric {
  tag: InvestmentTag;
  hours: number;
  count: number;
  share: number;
  color: string;
  icon: string;
  hint: string;
  /** 其中被默认补为「维持」、仍待用户确认的小时数，避免这部分时间被漏算或误读 */
  pendingHours: number;
  pendingCount: number;
}

/**
 * 按投入质量标签聚合。待补标的旧记录在落库时已归入默认标签「维持」，
 * 因此这里的总量天然包含全部时间，缺标签不会导致漏算。
 */
export function tagMetricsFor(records: InvestmentRecord[]): TagMetric[] {
  const total = totalInvested(records);
  return TAGS.map((tag) => {
    const tagged = records.filter((item) => item.tag === tag);
    const pending = tagged.filter((item) => item.tagPending);
    const meta = TAG_META[tag];
    return {
      tag,
      hours: tagged.reduce((sum, item) => sum + item.hours, 0),
      count: tagged.length,
      share: total ? tagged.reduce((sum, item) => sum + item.hours, 0) / total : 0,
      color: meta.color,
      icon: meta.icon,
      hint: meta.hint,
      pendingHours: pending.reduce((sum, item) => sum + item.hours, 0),
      pendingCount: pending.length,
    };
  });
}

export type QualityLevel = '高效' | '待观察' | '偏耗损';

export interface CategoryQuality {
  category: TimeCategory;
  color: string;
  icon: string;
  label: string;
  hours: number;
  count: number;
  tagHours: Record<InvestmentTag, number>;
  tagShares: Record<InvestmentTag, number>;
  pendingCount: number;
  level: QualityLevel;
}

export function categoryQualityFor(records: InvestmentRecord[]): CategoryQuality[] {
  return CATEGORIES.map((category) => {
    const items = records.filter((item) => item.category === category);
    const hours = items.reduce((sum, item) => sum + item.hours, 0);
    const tagHours = TAGS.reduce((acc, tag) => {
      acc[tag] = items.filter((item) => item.tag === tag).reduce((sum, item) => sum + item.hours, 0);
      return acc;
    }, {} as Record<InvestmentTag, number>);
    const tagShares = TAGS.reduce((acc, tag) => {
      acc[tag] = hours ? tagHours[tag] / hours : 0;
      return acc;
    }, {} as Record<InvestmentTag, number>);
    let level: QualityLevel = '待观察';
    if (hours > 0) {
      if (tagShares['高投入'] >= 0.5) level = '高效';
      else if (tagShares['低效'] >= 0.4) level = '偏耗损';
    }
    const meta = CATEGORY_META[category];
    return { category, color: meta.color, icon: meta.icon, label: meta.label, hours, count: items.length, tagHours, tagShares, pendingCount: items.filter((item) => item.tagPending).length, level };
  });
}

/** 基于投入质量标签的再平衡信号，与按类别的 suggestions 互补 */
export function qualitySuggestions(quality: CategoryQuality[], tagMetrics: TagMetric[]): string[] {
  const totalHours = tagMetrics.reduce((sum, item) => sum + item.hours, 0);
  const result: string[] = [];
  const low = tagMetrics.find((item) => item.tag === '低效');
  const high = tagMetrics.find((item) => item.tag === '高投入');
  if (totalHours && low && low.share >= 0.1) {
    result.push(`低效投入占了 ${Math.round(low.share * 100)}%（${low.hours.toFixed(1)}h），先挑其中耗时最长的一笔，下周试着压缩一半。`);
  }
  const drains = quality.filter((item) => item.hours > 0 && item.tagShares['低效'] >= 0.4).sort((a, b) => b.tagHours['低效'] - a.tagHours['低效']);
  if (drains.length) {
    const top = drains[0];
    result.push(`「${top.category}」有 ${Math.round(top.tagShares['低效'] * 100)}% 被标为低效，这块时间更像在消耗你，值得重新设计做法或频次。`);
  }
  if (totalHours && high && high.share < 0.25) {
    result.push(`真正高投入的时间只有 ${Math.round(high.share * 100)}%，给最有效的那件事固定一个不被打扰的时段，先把占比提到 30%。`);
  }
  if (tagMetrics.some((item) => item.pendingCount > 0)) {
    const count = tagMetrics.reduce((sum, item) => sum + item.pendingCount, 0);
    result.push(`还有 ${count} 笔旧记录沿用默认标签「维持」，补标后分析会更贴近你的真实体感。`);
  }
  if (!result.length) result.push('各类资产的投入质量结构清晰，保持每周复盘，把「高投入」的经验复制到其他资产上。');
  return result;
}

export function record(category: TimeCategory, hours: number, note: string, tag: InvestmentTag = DEFAULT_TAG, date = new Date().toISOString()): InvestmentRecord {
  return { id: `time-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, category, hours: Math.max(0.5, Number(hours) || 0.5), note: note.trim() || '未命名投资', date, tag, tagPending: false };
}

/**
 * 旧数据迁移：没有标签（或标签非法）的记录统一补默认值「维持」并标记待补。
 * 返回的记录始终带合法标签，下游聚合不会因为缺字段而漏掉任何时间。
 */
export function normalizeRecords(raw: Array<Partial<InvestmentRecord> | null | undefined>): InvestmentRecord[] {
  return raw.filter(Boolean).map((item) => {
    const hasTag = TAGS.includes(item!.tag as InvestmentTag);
    return {
      id: item!.id || `time-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category: item!.category as TimeCategory,
      hours: Number(item!.hours) || 0.5,
      note: item!.note || '未命名投资',
      date: item!.date || new Date().toISOString(),
      tag: hasTag ? (item!.tag as InvestmentTag) : DEFAULT_TAG,
      tagPending: hasTag ? !!item!.tagPending : true,
    };
  });
}

export function sampleSnapshot() {
  const account: TimeAccount = { dailyHours: 8, weeklyHours: 56, updatedAt: new Date().toISOString() };
  const seed: Array<[TimeCategory, number, string, InvestmentTag]> = [
    ['事业', 16, '产品策略与交付', '高投入'], ['学习', 10, '阅读与课程', '高投入'], ['健康', 7, '力量训练与散步', '维持'],
    ['关系', 8, '家人和朋友', '高投入'], ['休息', 9, '睡眠与留白', '维持'], ['娱乐', 4, '电影与游戏', '低效'],
  ];
  return { account, records: seed.map(([category, hours, note, tag], index) => record(category, hours, note, tag, new Date(Date.now() - index * 86400000).toISOString())) };
}

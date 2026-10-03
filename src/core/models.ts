export type TimeCategory = '健康' | '学习' | '关系' | '事业' | '娱乐' | '休息';

export type InvestmentTag = '高投入' | '维持' | '低效';

export interface TimeAccount {
  dailyHours: number;
  weeklyHours: number;
  updatedAt: string;
}

export interface InvestmentRecord {
  id: string;
  category: TimeCategory;
  hours: number;
  note: string;
  date: string;
  tag: InvestmentTag;
  /** 旧记录迁移而来：标签先取默认值，等待用户首次补标 */
  tagPending?: boolean;
}

export interface TimeSnapshot {
  account: TimeAccount;
  records: InvestmentRecord[];
}

export interface CategoryMetric {
  category: TimeCategory;
  hours: number;
  share: number;
  roi: number;
  color: string;
  icon: string;
}

export const CATEGORIES: TimeCategory[] = ['健康', '学习', '关系', '事业', '娱乐', '休息'];

export const CATEGORY_META: Record<TimeCategory, { color: string; icon: string; roi: number; label: string }> = {
  健康: { color: '#f07f68', icon: '✦', roi: 1.65, label: '身体是第一账户' },
  学习: { color: '#75a8e8', icon: '↗', roi: 2.25, label: '复利型成长' },
  关系: { color: '#d68ad6', icon: '♡', roi: 1.9, label: '长期信任资产' },
  事业: { color: '#e6b65c', icon: '◒', roi: 2.5, label: '创造与交付' },
  娱乐: { color: '#68c4aa', icon: '◇', roi: 1.2, label: '恢复与好奇' },
  休息: { color: '#9b91df', icon: '☾', roi: 1.8, label: '恢复系统' },
};

/** 旧记录缺少标签时的默认归类：中性的「维持」，保证时间不漏算 */
export const DEFAULT_TAG: InvestmentTag = '维持';

export const TAGS: InvestmentTag[] = ['高投入', '维持', '低效'];

export const TAG_META: Record<InvestmentTag, { color: string; icon: string; hint: string }> = {
  高投入: { color: '#c7dc70', icon: '↑', hint: '真正有效、值得加码' },
  维持: { color: '#7fa7e0', icon: '→', hint: '保持节奏的必要投入' },
  低效: { color: '#e88c5e', icon: '↓', hint: '只是耗时间，需要优化' },
};

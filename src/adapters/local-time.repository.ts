import type { TimeRepository } from '../ports/time-repository.port';
import type { InvestmentRecord, TimeSnapshot } from '../core/models';
import { TAGS } from '../core/models';
import { normalizeRecords, sampleSnapshot } from '../core/time-engine';

const KEY = 'c2c-001-time-investment';
export class LocalTimeRepository implements TimeRepository {
  load(): TimeSnapshot {
    try {
      const value = localStorage.getItem(KEY);
      if (value) {
        const parsed = JSON.parse(value) as Partial<TimeSnapshot>;
        const rawRecords = parsed.records ?? [];
        const needsMigration = rawRecords.some((item) => !item || !TAGS.includes(item.tag as InvestmentRecord['tag']));
        const records = normalizeRecords(rawRecords);
        const snapshot: TimeSnapshot = {
          account: parsed.account ?? sampleSnapshot().account,
          records,
        };
        // 旧记录一旦补齐默认标签就回写，保证缺标签的时间也被纳入持久化统计
        if (needsMigration) this.save(snapshot);
        return snapshot;
      }
    } catch { /* 数据损坏时回落到种子数据 */ }
    return sampleSnapshot();
  }
  save(snapshot: TimeSnapshot) { localStorage.setItem(KEY, JSON.stringify(snapshot)); }
}

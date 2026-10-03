<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { LocalTimeRepository } from '../adapters/local-time.repository';
import { CATEGORIES, CATEGORY_META, TAGS, TAG_META, DEFAULT_TAG, type InvestmentTag, type TimeCategory } from '../core/models';
import { balanceSheet, categoryQualityFor, metricsFor, portfolioScore, qualitySuggestions, record, sampleSnapshot, suggestions, tagMetricsFor, totalInvested, type QualityLevel } from '../core/time-engine';
import type { InvestmentRecord } from '../core/models';

const repo = new LocalTimeRepository();
const TAG_PROMPT_DISMISS_KEY = 'c2c-001-tag-prompt-dismissed';
const tab = ref<'总览' | '记录' | '组合' | '分析'>('总览');
const notice = ref('');
const state = reactive(repo.load());
const accountDraft = reactive({ dailyHours: state.account.dailyHours, weeklyHours: state.account.weeklyHours });
const draft = reactive({ category: '事业' as TimeCategory, hours: 2, note: '', tag: DEFAULT_TAG as InvestmentTag });
const tagFilter = ref<'全部' | '待补标' | InvestmentTag>('全部');
const showTagPrompt = ref(false);

const metrics = computed(() => metricsFor(state.records));
const invested = computed(() => totalInvested(state.records));
const score = computed(() => portfolioScore(metrics.value, state.account));
const sheet = computed(() => balanceSheet(metrics.value, state.account));
const tagMetrics = computed(() => tagMetricsFor(state.records));
const quality = computed(() => categoryQualityFor(state.records));
const highShare = computed(() => tagMetrics.value.find((item) => item.tag === '高投入')?.share ?? 0);
const pendingCount = computed(() => state.records.filter((item) => item.tagPending).length);
const tips = computed(() => [...qualitySuggestions(quality.value, tagMetrics.value), ...suggestions(metrics.value, state.account)]);
const recent = computed(() => [...state.records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5));
const ledgerRecords = computed(() => [...state.records].sort((a, b) => b.date.localeCompare(a.date)));
const filteredLedger = computed(() => {
  if (tagFilter.value === '全部') return ledgerRecords.value;
  if (tagFilter.value === '待补标') return ledgerRecords.value.filter((item) => item.tagPending);
  return ledgerRecords.value.filter((item) => item.tag === tagFilter.value);
});

function save() { repo.save({ account: state.account, records: state.records }); }
function updateAccount() { state.account.dailyHours = Math.max(1, Number(accountDraft.dailyHours) || 1); state.account.weeklyHours = Math.max(1, Number(accountDraft.weeklyHours) || 1); state.account.updatedAt = new Date().toISOString(); save(); notice.value = '时间账户已更新'; }
function addRecord() { state.records.unshift(record(draft.category, draft.hours, draft.note, draft.tag)); save(); draft.note = ''; notice.value = '一笔时间投资已入账'; tab.value = '记录'; tagFilter.value = '全部'; }
function removeRecord(id: string) { state.records = state.records.filter((item) => item.id !== id); save(); }
function resetDemo() { const fresh = sampleSnapshot(); state.account = fresh.account; state.records = fresh.records; localStorage.removeItem(TAG_PROMPT_DISMISS_KEY); save(); notice.value = '已恢复初始示例组合'; }
function updateTag(item: InvestmentRecord, event: Event) {
  const tag = (event.target as HTMLSelectElement).value as InvestmentTag;
  if (!TAGS.includes(tag)) return;
  const target = state.records.find((r) => r.id === item.id);
  if (!target) return;
  target.tag = tag;
  target.tagPending = false;
  save();
  notice.value = `已将这笔投入标记为「${tag}」`;
}
function countByTag(tag: InvestmentTag) { return state.records.filter((item) => item.tag === tag).length; }
function levelClass(level: QualityLevel) { return level === '高效' ? 'level-good' : level === '偏耗损' ? 'level-bad' : 'level-watch'; }
function tagStyle(tag: InvestmentTag, selected = true) { return selected ? { '--tag-color': TAG_META[tag].color } as Record<string, string> : {}; }
function closeTagPrompt() { showTagPrompt.value = false; localStorage.setItem(TAG_PROMPT_DISMISS_KEY, '1'); }
function startBackfill() { closeTagPrompt(); tab.value = '记录'; tagFilter.value = '待补标'; notice.value = '逐笔确认标签即可，改完自动计入分析'; }
function acceptAllDefault() { state.records.forEach((item) => { item.tagPending = false; }); save(); closeTagPrompt(); notice.value = '旧记录已全部按「维持」归类，之后可随时在流水中修改'; }

watch(pendingCount, (count) => { if (count === 0) localStorage.removeItem(TAG_PROMPT_DISMISS_KEY); });
onMounted(() => {
  if (pendingCount.value > 0 && !localStorage.getItem(TAG_PROMPT_DISMISS_KEY)) showTagPrompt.value = true;
});
</script>

<template>
  <div class="app-shell investment-app">
    <header class="topbar">
      <div class="brand"><div class="brand-mark">时</div><div><span class="eyebrow">LIFE CAPITAL / 01</span><h1>人生时间投资所</h1></div></div>
      <div class="top-actions"><span class="live-dot">本周账期进行中</span><button class="ghost-button" type="button" @click="resetDemo">↻ 重置演示</button></div>
    </header>
    <main class="page-wrap">
      <section class="hero-row">
        <div><p class="eyebrow accent-text">个人时间资产管理台</p><h2>把今天的小时，<em>配置成明天的底气。</em></h2><p class="hero-copy">你的时间不是被消耗的余额，而是一支每天都在重新开盘的投资组合。</p></div>
        <div class="hero-date"><span>当前周期</span><strong>WEEK 40</strong><small>2026 · 10 / 01 — 10 / 07</small></div>
      </section>
      <nav class="tabs" aria-label="功能模块"><button v-for="item in ['总览', '记录', '组合', '分析']" :key="item" type="button" :class="{ active: tab === item }" @click="tab = item as typeof tab">{{ item }}<span v-if="item === '记录'" class="tab-count">{{ state.records.length }}</span><span v-if="item === '分析' && pendingCount" class="tab-count tab-count-pending">{{ pendingCount }}</span></button></nav>

      <section v-if="tab === '总览'" class="content-grid overview-grid">
        <article class="panel account-panel"><div class="panel-heading"><div><span class="eyebrow">TIME ACCOUNT</span><h3>时间账户</h3></div><span class="panel-index">01 / 05</span></div><div class="account-number"><strong>{{ state.account.weeklyHours }}</strong><span>可配置小时 / 周</span></div><div class="meter"><span :style="{ width: `${Math.min(100, invested / state.account.weeklyHours * 100)}%` }"></span></div><div class="split-line"><span>已配置 <b>{{ invested.toFixed(1) }}h</b></span><span>剩余 <b>{{ Math.max(0, state.account.weeklyHours - invested).toFixed(1) }}h</b></span></div><div class="account-form"><label>每日可支配<input v-model.number="accountDraft.dailyHours" type="number" min="1" step="0.5" />小时</label><label>每周可配置<input v-model.number="accountDraft.weeklyHours" type="number" min="1" step="1" />小时</label><button class="primary-button" type="button" @click="updateAccount">更新账户 →</button></div></article>
        <article class="panel score-panel"><div class="panel-heading"><div><span class="eyebrow">PORTFOLIO HEALTH</span><h3>组合健康度</h3></div><span class="panel-index">02 / 05</span></div><div class="score-layout"><div class="score-ring" :style="{ '--score': `${Math.min(100, score * 20)}%` }"><div><strong>{{ score }}</strong><span>/ 10</span></div></div><div><p class="score-label">复利潜力良好</p><p class="muted">基于 {{ state.records.length }} 笔投资记录与各资产类别的历史回报估算。</p><div class="legend-list"><span><i class="dot green"></i>配置平衡</span><span><i class="dot yellow"></i>可继续优化</span></div></div></div></article>
        <article class="panel chart-panel"><div class="panel-heading"><div><span class="eyebrow">ALLOCATION MAP</span><h3>时间资产配置</h3></div><button class="text-button" type="button" @click="tab = '组合'">查看组合 →</button></div><div class="allocation-layout"><div class="donut" :style="{ background: `conic-gradient(${metrics.map((item) => `${item.color} ${item.share * 100}%`).join(', ')})` }"><div><strong>{{ Math.round(invested) }}</strong><span>hours</span></div></div><div class="metric-list"><div v-for="item in metrics" :key="item.category" class="metric-row"><i class="category-symbol" :style="{ color: item.color }">{{ item.icon }}</i><span>{{ item.category }}</span><strong>{{ item.hours.toFixed(1) }}h</strong><small>{{ Math.round(item.share * 100) }}%</small></div></div></div></article>
        <article class="panel ledger-panel"><div class="panel-heading"><div><span class="eyebrow">RECENT ACTIVITY</span><h3>最近投资</h3></div><button class="text-button" type="button" @click="tab = '记录'">全部记录 →</button></div><div class="activity-list"><div v-for="item in recent" :key="item.id" class="activity-row"><span class="activity-icon" :style="{ background: CATEGORY_META[item.category].color }">{{ CATEGORY_META[item.category].icon }}</span><div><strong>{{ item.note }}</strong><small><i class="activity-tag-dot" :style="{ background: TAG_META[item.tag].color }"></i>{{ item.category }} · {{ item.tag }}<template v-if="item.tagPending">（默认）</template> · {{ new Date(item.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) }}</small></div><b>+{{ item.hours }}h</b></div></div></article>
      </section>

      <section v-else-if="tab === '记录'" class="content-grid record-grid"><article class="panel form-panel"><div class="panel-heading"><div><span class="eyebrow">NEW INVESTMENT</span><h3>记录一笔时间</h3></div><span class="panel-index">02 / 05</span></div><p class="muted intro">每一次记录，都是在告诉未来的自己：这段时间值得。</p><label>投资到<select v-model="draft.category"><option v-for="item in CATEGORIES" :key="item" :value="item">{{ item }} · {{ CATEGORY_META[item].label }}</option></select></label><label>投入小时<input v-model.number="draft.hours" type="number" min="0.5" step="0.5" /></label><label>这段时间做了什么<textarea v-model="draft.note" rows="4" placeholder="例如：完成了季度复盘"></textarea></label><div class="field-caption"><span>投入质量</span><small>这段时间是真正有效，还是只是耗时间？</small></div><div class="tag-picker" role="radiogroup" aria-label="投入质量标签"><button v-for="t in TAGS" :key="t" type="button" role="radio" :aria-checked="draft.tag === t" :class="draft.tag === t ? 'tag-choice selected' : 'tag-choice'" :style="tagStyle(t, draft.tag === t)" @click="draft.tag = t"><i>{{ TAG_META[t].icon }}</i><b>{{ t }}</b><small>{{ TAG_META[t].hint }}</small></button></div><button class="primary-button full-button" type="button" @click="addRecord">确认入账 →</button><p class="notice">{{ notice }}</p></article><article class="panel table-panel"><div class="panel-heading"><div><span class="eyebrow">INVESTMENT LEDGER</span><h3>投资流水</h3></div><span class="total-pill">{{ filteredLedger.length }} / {{ state.records.length }} 笔</span></div><div class="tag-filters"><button type="button" :class="{ active: tagFilter === '全部' }" @click="tagFilter = '全部'">全部 {{ state.records.length }}</button><button v-for="t in TAGS" :key="t" type="button" :class="{ active: tagFilter === t }" :style="tagStyle(t)" @click="tagFilter = t">{{ TAG_META[t].icon }} {{ t }} {{ countByTag(t) }}</button><button v-if="pendingCount" type="button" class="pending-filter" :class="{ active: tagFilter === '待补标' }" @click="tagFilter = '待补标'">● 待补标 {{ pendingCount }}</button></div><div v-if="pendingCount" class="pending-banner"><i class="pending-dot"></i><p>{{ pendingCount }} 笔旧记录缺少标签，已暂按默认值「{{ DEFAULT_TAG }}」计入，下面的小时与占比<strong>没有漏掉任何时间</strong>。</p><button class="text-button" type="button" @click="showTagPrompt = true">补标说明 →</button></div><div class="ledger-table"><div class="table-head"><span>资产类别</span><span>备注</span><span>投入质量</span><span>小时</span><span>日期</span><span></span></div><div v-for="item in filteredLedger" :key="item.id" class="table-row"><span class="category-cell"><i :style="{ color: CATEGORY_META[item.category].color }">{{ CATEGORY_META[item.category].icon }}</i>{{ item.category }}</span><span class="note-cell">{{ item.note }}</span><span class="tag-cell"><select class="tag-select" :value="item.tag" :style="tagStyle(item.tag)" :title="item.tagPending ? '旧记录默认标签，确认后即完成补标' : '修改这笔投入的质量标签'" @change="updateTag(item, $event)"><option v-for="t in TAGS" :key="t" :value="t">{{ TAG_META[t].icon }} {{ t }}</option></select><i v-if="item.tagPending" class="pending-dot"></i></span><strong>{{ item.hours }}h</strong><span class="date-cell">{{ new Date(item.date).toLocaleDateString('zh-CN') }}</span><button class="delete-button" type="button" title="删除记录" @click="removeRecord(item.id)">×</button></div><p v-if="!filteredLedger.length" class="empty-ledger">该筛选下暂无记录。</p></div></article></section>

      <section v-else-if="tab === '组合'" class="content-grid portfolio-grid"><article class="panel wide-panel"><div class="panel-heading"><div><span class="eyebrow">ASSET ALLOCATION</span><h3>投资组合</h3></div><span class="panel-index">03 / 05</span></div><div class="portfolio-cards"><div v-for="item in metrics" :key="item.category" class="portfolio-card" :style="{ '--category-color': item.color }"><div class="portfolio-card-top"><span class="portfolio-icon">{{ item.icon }}</span><span>{{ Math.round(item.share * 100) }}%</span></div><h4>{{ item.category }}</h4><p>{{ CATEGORY_META[item.category].label }}</p><div class="mini-meter"><i :style="{ width: `${Math.min(100, item.share * 200)}%` }"></i></div><div class="portfolio-card-foot"><strong>{{ item.hours.toFixed(1) }}h</strong><span>ROI {{ item.roi.toFixed(2) }}x</span></div></div></div></article><article class="panel balance-panel"><div class="panel-heading"><div><span class="eyebrow">LIFE BALANCE SHEET</span><h3>人生资产负债表</h3></div><span class="panel-index">04 / 05</span></div><div class="balance-figure"><div><span>时间资产</span><strong>{{ sheet.assets }} <small>价值点</small></strong></div><div><span>未配置负债</span><strong class="liability">{{ sheet.liabilities }} <small>小时</small></strong></div><div class="balance-total"><span>净人生资产</span><strong>{{ sheet.equity }}</strong></div></div></article></section>

      <section v-else class="content-grid analysis-grid">
        <article class="panel wide-panel quality-summary-panel"><div class="panel-heading"><div><span class="eyebrow">INVESTMENT QUALITY</span><h3>投入质量总览</h3></div><span class="panel-index">05 / 07</span></div><div class="quality-stats"><div><small>有效投入率</small><strong>{{ Math.round(highShare * 100) }}%</strong><span>高投入 ÷ 全部已统计时间</span></div><div><small>总投入</small><strong>{{ invested.toFixed(1) }}h</strong><span>{{ state.records.length }} 笔记录，全部计入</span></div><div><small>待补标</small><strong :class="{ 'pending-number': pendingCount }">{{ pendingCount }}</strong><span>笔旧记录暂按「{{ DEFAULT_TAG }}」计入</span></div></div><div class="quality-stack"><i v-for="m in tagMetrics" :key="m.tag" :style="{ width: `${m.share * 100}%`, background: m.color }" :title="`${m.tag} ${Math.round(m.share * 100)}%`"></i></div><div class="quality-legend"><div v-for="m in tagMetrics" :key="m.tag" class="quality-tag-row"><span class="quality-tag-name"><i class="tag-dot" :style="{ background: m.color }"></i>{{ m.icon }} {{ m.tag }}<small>{{ m.hint }}</small></span><strong>{{ m.hours.toFixed(1) }}h · {{ m.count }} 笔 · {{ Math.round(m.share * 100) }}%</strong><em v-if="m.pendingCount" class="pending-note">含 {{ m.pendingCount }} 笔默认标签 / {{ m.pendingHours.toFixed(1) }}h</em></div></div><p class="footnote">缺标签的旧记录在加载时已自动补为默认值「{{ DEFAULT_TAG }}」并计入总投入，任何小时都不会因未补标而漏算；补标后占比即时更新。</p></article>
        <article class="panel wide-panel category-quality-panel"><div class="panel-heading"><div><span class="eyebrow">ASSET QUALITY MATRIX</span><h3>各类资产投入质量</h3></div><span class="panel-index">06 / 07</span></div><div v-for="q in quality" :key="q.category" class="quality-row"><div class="quality-row-head"><span class="quality-asset"><i :style="{ color: q.color }">{{ q.icon }}</i>{{ q.category }}<small>{{ q.label }}</small></span><span :class="['level-badge', levelClass(q.level)]">{{ q.hours ? q.level : '暂无投入' }}</span><strong>{{ q.hours.toFixed(1) }}h · {{ q.count }} 笔</strong></div><div class="quality-row-bar"><i v-for="t in TAGS" :key="t" :style="{ width: `${q.tagShares[t] * 100}%`, background: TAG_META[t].color }"></i></div><div class="quality-row-foot"><span v-for="t in TAGS" :key="t"><i class="tag-dot" :style="{ background: TAG_META[t].color }"></i>{{ t }} {{ Math.round(q.tagShares[t] * 100) }}%</span><em v-if="q.pendingCount" class="pending-note">{{ q.pendingCount }} 笔待补标，已计入</em></div></div><p class="footnote">等级按该资产内高投入 / 低效的小时占比评定：高投入 ≥ 50% 为「高效」，低效 ≥ 40% 为「偏耗损」，其余为「待观察」。</p></article>
        <article class="panel suggestions-panel"><div class="panel-heading"><div><span class="eyebrow">REBALANCE SIGNALS</span><h3>配置优化建议</h3></div><span class="panel-index">07 / 07</span></div><div class="suggestion-list"><div v-for="(tip, index) in tips" :key="index" class="suggestion"><span>0{{ index + 1 }}</span><p>{{ tip }}</p><b>→</b></div></div></article><article class="panel roi-panel"><div class="panel-heading"><div><span class="eyebrow">RETURN ON INVESTMENT</span><h3>时间 ROI 分析</h3></div></div><div class="roi-list"><div v-for="item in metrics" :key="item.category" class="roi-row"><div class="roi-name"><i :style="{ background: item.color }"></i><span>{{ item.category }}</span></div><div class="roi-bar"><span :style="{ width: `${item.roi / 2.5 * 100}%`, background: item.color }"></span></div><strong>{{ item.roi.toFixed(2) }}x</strong></div></div><p class="footnote">ROI 是基于精力恢复、能力复利、关系质量与长期机会成本的个人化估算，不代表财务回报。</p></article></section>
      <p v-if="notice && tab !== '记录'" class="toast">{{ notice }}</p>
    </main>

    <div v-if="showTagPrompt" class="modal-overlay" @click.self="closeTagPrompt">
      <div class="tag-modal panel" role="dialog" aria-modal="true" aria-labelledby="tag-modal-title">
        <div class="panel-heading"><div><span class="eyebrow">TAG BACKFILL</span><h3 id="tag-modal-title">给旧记录补上投入质量</h3></div><span class="panel-index">{{ pendingCount }} 笔待处理</span></div>
        <p class="muted">发现 {{ pendingCount }} 笔旧记录没有质量标签，已先按默认值「{{ DEFAULT_TAG }}」计入分析，<strong style="color: var(--cream)">时间不会因为缺标签而漏算</strong>。花一分钟补标，就能看清哪些投入真正有效、哪些只是耗时间。</p>
        <div class="modal-tag-legend"><div v-for="t in TAGS" :key="t" class="modal-tag-card" :style="tagStyle(t)"><i>{{ TAG_META[t].icon }}</i><b>{{ t }}</b><small>{{ TAG_META[t].hint }}</small></div></div>
        <div class="modal-actions"><button class="ghost-button" type="button" @click="closeTagPrompt">稍后再说</button><button class="ghost-button" type="button" @click="acceptAllDefault">全部维持「{{ DEFAULT_TAG }}」</button><button class="primary-button" type="button" @click="startBackfill">逐笔补标 →</button></div>
      </div>
    </div>
  </div>
</template>

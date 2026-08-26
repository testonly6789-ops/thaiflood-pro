const MIGRATION_KEY = 'thaiflood:ddpm-cache-schema';
const TARGET_VERSION = '6';
const INDEX_CACHE_KEY = 'thaiflood:recurrence-index:v1';
const INDEX_TTL = 7 * 24 * 60 * 60 * 1000;

try {
  if (localStorage.getItem(MIGRATION_KEY) !== TARGET_VERSION) {
    const prefixes = ['thaiflood:ddpm-fast:', 'thaiflood:ddpm-fast:v2:', 'thaiflood:ddpm-fast:v3:'];
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && prefixes.some(prefix => key.startsWith(prefix))) localStorage.removeItem(key);
    }
    localStorage.setItem(MIGRATION_KEY, TARGET_VERSION);
  }
} catch {}

const nativeFetch = window.fetch.bind(window);
let recurrencePayload = null;
let recurrenceMap = new Map();

function indexFromPayload(payload) {
  if (!payload?.ok || !Array.isArray(payload.provinces)) return new Map();
  return new Map(payload.provinces.map(item => [item.province, item]));
}

function readIndexCache() {
  try {
    const raw = localStorage.getItem(INDEX_CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry?.data || Date.now() - Number(entry.ts || 0) > INDEX_TTL) return null;
    return entry.data;
  } catch { return null; }
}

function writeIndexCache(data) {
  try { localStorage.setItem(INDEX_CACHE_KEY, JSON.stringify({ ts:Date.now(), data })); } catch {}
}

async function loadRecurrenceIndex() {
  const cached = readIndexCache();
  if (cached?.ok) {
    recurrencePayload = cached;
    recurrenceMap = indexFromPayload(cached);
    return cached;
  }
  const r = await nativeFetch('/api/ddpm-index', { cache:'default' });
  const data = await r.json();
  if (!r.ok || !data?.ok) throw new Error(data?.error || 'โหลดดัชนีน้ำท่วมซ้ำไม่สำเร็จ');
  recurrencePayload = data;
  recurrenceMap = indexFromPayload(data);
  writeIndexCache(data);
  return data;
}

const recurrenceIndexPromise = loadRecurrenceIndex().catch(() => null);
await Promise.race([recurrenceIndexPromise, new Promise(resolve => setTimeout(resolve, 1800))]);

function rewriteHistoryWithOfficialRecurrence(data) {
  if (!data?.ok || !recurrenceMap.size) return data;
  const provinces = (data.provinces || []).map(p => {
    const rec = recurrenceMap.get(p.name);
    if (!rec) return p;
    return {
      ...p,
      recurrence:rec.floodYears,
      recurrenceYears:rec.floodYearList || [],
      recurrenceCheckedYears:rec.checkedYears || 7,
      recurrenceRatePct:rec.ratePct,
    };
  });
  return {
    ...data,
    provinces,
    ranked:provinces.filter(p => Number(p.recurrence || 0) >= 2)
      .sort((a,b) => Number(b.recurrence || 0) - Number(a.recurrence || 0) || a.name.localeCompare(b.name,'th')),
    window:{ start:2562, end:2568, years:7 },
  };
}

window.fetch = async (input, init) => {
  try {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    if (rawUrl) {
      const u = new URL(rawUrl, location.origin);
      if (u.pathname === '/api/history') {
        const r = await nativeFetch(input, init);
        if (!r.ok || !recurrenceMap.size) return r;
        const data = await r.clone().json();
        const rewritten = rewriteHistoryWithOfficialRecurrence(data);
        return new Response(JSON.stringify(rewritten), {
          status:r.status,
          headers:{ 'Content-Type':'application/json; charset=utf-8' },
        });
      }
      if (u.pathname === '/api/ddpm-fast') {
        u.searchParams.set('_schema', 'all-77-recurrence-v1');
        const next = u.origin === location.origin ? u.pathname + u.search : u.toString();
        return nativeFetch(next, init);
      }
    }
  } catch {}
  return nativeFetch(input, init);
};

await import('/app-base.js?v=20260826-all77-v1');
window.__tfRecurrenceIndex = recurrenceMap;

function selectedName() {
  const name = document.querySelector('#selectedName')?.textContent?.trim();
  return name && name !== '—' ? name : null;
}

function selectedRecurrence() {
  const name = selectedName();
  return name ? recurrenceMap.get(name) : null;
}

function normalizeRecurrenceWords() {
  const selectors = ['#topProvinceMeta','.hotspot-chip small','.freq-pill','.search-item > span:last-child','.map-popup p'];
  document.querySelectorAll(selectors.join(',')).forEach(el => {
    let text = el.textContent || '';
    if (!text.includes('ครั้ง')) return;
    text = text.replace(/(\d[\d,]*)\s*ครั้ง\s*\/\s*7\s*ปี/g, '$1 ปี / 7 ปี');
    text = text.replace(/(\d[\d,]*)\s*ครั้ง/g, '$1 ปี');
    if (el.textContent !== text) el.textContent = text;
  });
}

function renderRecurrenceMatrix(rec) {
  const box = document.querySelector('#yearMatrix');
  if (!box || !rec) return;
  const flooded = new Set((rec.floodYearList || []).map(Number));
  const cells = [...box.querySelectorAll('.year-cell')];
  cells.forEach((cell, i) => {
    const b = cell.querySelector('b');
    const span = cell.querySelector('span');
    const suffix = Number(b?.textContent);
    const year = Number.isFinite(suffix) ? 2500 + suffix : 2562 + i;
    const hasFlood = flooded.has(year);
    cell.classList.toggle('has-event', hasFlood);
    if (span) span.textContent = hasFlood ? 'ท่วม' : 'ไม่พบ';
    cell.title = hasFlood ? `พ.ศ. ${year} พบอุทกภัยในจังหวัด` : `พ.ศ. ${year} ไม่พบอุทกภัยในชุดข้อมูลที่เชื่อมต่อ`;
  });
}

function ensureSummaryCards(rec) {
  const name = selectedName();
  const data = name ? window.__tfOfficial?.[name] : null;
  const details = document.querySelector('#eventDetails');
  if (!details || !data?.ok || !rec) return;

  details.querySelectorAll('.tf-summary-card').forEach(el => el.remove());
  const detailYears = new Set((data.years || []).map(y => Number(y.year)));
  const summaries = (data.provinceSummaryYears || [])
    .filter(y => (rec.floodYearList || []).includes(Number(y.year)) && !detailYears.has(Number(y.year)))
    .sort((a,b) => Number(b.year) - Number(a.year));

  summaries.forEach(y => {
    const card = document.createElement('article');
    card.className = 'event-card tf-summary-card';
    card.id = `event-${y.year}`;
    const households = y.households == null ? 'ไม่มีข้อมูล' : Number(y.households).toLocaleString('th-TH');
    const agri = y.agriRai == null ? 'ไม่มีข้อมูล' : `${Number(y.agriRai).toLocaleString('th-TH',{maximumFractionDigits:1})} ไร่`;
    const damage = y.totalDamageM == null ? 'ไม่มีข้อมูล' : `${Number(y.totalDamageM).toLocaleString('th-TH',{maximumFractionDigits:2})} ล้านบาท`;
    const occurrence = y.occurrenceCount == null ? 'ไม่มีข้อมูลจำนวนครั้ง' : `${Number(y.occurrenceCount).toLocaleString('th-TH')} ครั้ง`;
    card.innerHTML = `
      <div class="event-head">
        <div class="event-year">พ.ศ. ${y.year}</div>
        <div class="event-title"><b>ข้อมูลสรุประดับจังหวัด</b><small>${occurrence} • ไม่มีรายละเอียดชื่ออำเภอในชุดนี้</small></div>
      </div>
      <div class="event-kpis">
        <article><span>ครัวเรือนที่ได้รับผลกระทบ</span><strong>${households}</strong><p>ข้อมูลสรุประดับจังหวัดจาก ปภ.</p></article>
        <article><span>พื้นที่เกษตรที่ได้รับผลกระทบ</span><strong>${agri}</strong><p>ความเสียหายที่มีข้อมูล: ${damage}</p></article>
      </div>
      <div class="event-note-grid"><div class="event-note"><h5>ขอบเขตข้อมูล</h5><p>ปีนี้ต้นทางให้ข้อมูลแบบสรุประดับจังหวัด จึงไม่สร้างชื่ออำเภอหรือตำบลขึ้นเอง</p></div></div>`;

    const lower = [...details.querySelectorAll('.event-card:not(.tf-summary-card)')]
      .find(el => Number((el.id || '').replace('event-','')) < Number(y.year));
    if (lower) details.insertBefore(card, lower); else details.appendChild(card);
  });
}

function applyOfficialRecurrenceUi() {
  const rec = selectedRecurrence();
  if (!rec) return;
  const start = recurrencePayload?.coverage?.start || 2562;
  const end = recurrencePayload?.coverage?.end || 2568;
  const checked = rec.checkedYears || 7;
  const value = rec.floodYears;
  const years = rec.floodYearList || [];

  const badge = document.querySelector('#recurrenceBadge');
  const badgeHtml = `<small>น้ำท่วมเกิดซ้ำระดับจังหวัด</small><strong>${value}</strong><span>${value}/${checked} ปี • ${start}–${end}</span>`;
  if (badge && badge.innerHTML !== badgeHtml) badge.innerHTML = badgeHtml;

  const metric = document.querySelector('#metricRecurrence');
  if (metric) {
    metric.textContent = value;
    const card = metric.parentElement;
    const label = card?.querySelector('span');
    const note = card?.querySelector('small');
    if (label) label.textContent = 'จำนวนปีที่จังหวัดมีอุทกภัย';
    if (note) note.textContent = `ระดับจังหวัด • ตรวจ ${checked} ปี`;
  }

  const officialYears = document.querySelector('#officialYears');
  if (officialYears) {
    officialYears.textContent = value;
    const label = officialYears.parentElement?.querySelector('span');
    if (label) label.textContent = 'จำนวนปีที่จังหวัดมีอุทกภัย';
  }

  const insight = document.querySelector('#patternInsight');
  if (insight) {
    const yearText = years.length ? years.join(', ') : 'ไม่พบ';
    insight.textContent = value > 0
      ? `พบอุทกภัยระดับจังหวัด ${value} จาก ${checked} ปีที่ตรวจสอบ: พ.ศ. ${yearText} หมายเหตุ: เป็นการนับระดับจังหวัด จึงอาจเกิดคนละอำเภอในแต่ละปี`
      : `ไม่พบอุทกภัยในชุดข้อมูล ปภ. ช่วง พ.ศ. ${start}–${end} สำหรับจังหวัดนี้`;
  }

  const confidenceLabel = document.querySelector('#confidenceLabel');
  const confidenceText = document.querySelector('#confidenceText');
  if (confidenceLabel) confidenceLabel.textContent = 'ความถี่จากข้อมูล ปภ. ครบช่วง 2562–2568';
  if (confidenceText) confidenceText.textContent = 'ตัวเลขหลักนับจำนวนปีที่จังหวัดมีอุทกภัยจากชุดข้อมูล ปภ. 7 ปี ส่วนรายละเอียดอำเภอ ครัวเรือน และความเสียหายจะแสดงเฉพาะฟิลด์ที่ต้นทางมีจริง';

  renderRecurrenceMatrix(rec);
  ensureSummaryCards(rec);
  normalizeRecurrenceWords();
}

let applying = false;
let queued = false;
let observer = null;
const watched = ['#selectedName','#recurrenceBadge','#yearMatrix','#eventDetails','#rankingList','#hotspotChips','#modalSearchResults']
  .map(s => document.querySelector(s)).filter(Boolean);

function connectObserver() {
  if (!observer) return;
  watched.forEach(el => observer.observe(el,{subtree:true,childList:true,characterData:true}));
}

function queueApply() {
  if (queued || applying) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    applying = true;
    observer?.disconnect();
    try { applyOfficialRecurrenceUi(); }
    finally {
      applying = false;
      connectObserver();
    }
  });
}

observer = new MutationObserver(queueApply);
connectObserver();
setTimeout(queueApply, 100);
setTimeout(queueApply, 600);

recurrenceIndexPromise.then(data => {
  if (!data?.ok) return;
  const wasEmpty = !recurrenceMap.size;
  recurrencePayload = data;
  recurrenceMap = indexFromPayload(data);
  window.__tfRecurrenceIndex = recurrenceMap;
  queueApply();
  if (wasEmpty) setTimeout(() => document.querySelector('#refreshBtn')?.click(), 50);
}).catch(() => null);

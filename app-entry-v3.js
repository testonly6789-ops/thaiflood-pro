const MIGRATION_KEY = 'thaiflood:ddpm-cache-schema';
const TARGET_VERSION = '5';

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

// Give the new recurrence response its own CDN cache key so an older cached
// response cannot keep showing the previous "years with data" metric.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  try {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    if (rawUrl) {
      const u = new URL(rawUrl, location.origin);
      if (u.pathname === '/api/ddpm-fast') {
        u.searchParams.set('_schema', 'flood-recurrence-v3');
        const next = u.origin === location.origin ? u.pathname + u.search : u.toString();
        return nativeFetch(next, init);
      }
    }
  } catch {}
  return nativeFetch(input, init);
};

await import('/app-base.js?v=20260826-flood-recurrence-v5');

function selectedOfficialData() {
  const name = document.querySelector('#selectedName')?.textContent?.trim();
  return name && window.__tfOfficial ? window.__tfOfficial[name] : null;
}

function applyFloodRecurrenceMeaning() {
  const data = selectedOfficialData();
  if (!data?.ok) return;

  const sm = data.summary || {};
  const floodYears = Number(sm.floodYears);
  const value = Number.isFinite(floodYears) ? floodYears : null;
  const start = Number(data.sourceCoverage?.start || 2562);
  const end = Number(data.sourceCoverage?.end || 2568);
  const checked = Number(sm.checkedYears || (end - start + 1));
  const yearList = Array.isArray(sm.floodYearList) ? sm.floodYearList : [];

  const badge = document.querySelector('#recurrenceBadge');
  const desiredBadge = `<small>น้ำท่วมซ้ำในช่วงที่ตรวจสอบ</small><strong>${value ?? '—'}</strong><span>ปี / ${start}–${end}</span>`;
  if (badge && badge.innerHTML !== desiredBadge) badge.innerHTML = desiredBadge;

  const recurrence = document.querySelector('#metricRecurrence');
  if (recurrence) {
    recurrence.textContent = value ?? 'ไม่มีข้อมูล';
    const card = recurrence.parentElement;
    const label = card?.querySelector('span');
    const note = card?.querySelector('small');
    if (label && label.textContent !== 'จำนวนปีที่เกิดน้ำท่วม') label.textContent = 'จำนวนปีที่เกิดน้ำท่วม';
    const desiredNote = `ยืนยันจากข้อมูล ปภ. ${start}–${end}`;
    if (note && note.textContent !== desiredNote) note.textContent = desiredNote;
  }

  const officialYears = document.querySelector('#officialYears');
  if (officialYears) {
    officialYears.textContent = value ?? 'ไม่มีข้อมูล';
    const label = officialYears.parentElement?.querySelector('span');
    if (label && label.textContent !== 'ปีที่ยืนยันว่ามีน้ำท่วม') label.textContent = 'ปีที่ยืนยันว่ามีน้ำท่วม';
  }

  const insight = document.querySelector('#patternInsight');
  if (insight && value != null) {
    const yearsText = yearList.length ? ` (${yearList.join(', ')})` : '';
    insight.textContent = value > 0
      ? `ยืนยันว่าพบอุทกภัย ${value} ปี จาก ${checked} ปีที่ตรวจสอบ${yearsText} โดยนับเฉพาะปีที่มีหลักฐานเกิดอุทกภัยจริง ไม่ได้นับเพียงการมีแถวข้อมูลในฐาน ปภ.`
      : `ไม่พบหลักฐานอุทกภัยในช่วง ${start}–${end} จากชุดข้อมูล ปภ. ที่เชื่อมต่อ`;
  }
}

const badge = document.querySelector('#recurrenceBadge');
const selectedName = document.querySelector('#selectedName');
const observeOptions = { subtree:true, childList:true, characterData:true };
let queued = false;
let recurrenceObserver = null;

function reconnectObserver() {
  if (!recurrenceObserver) return;
  if (badge) recurrenceObserver.observe(badge, observeOptions);
  if (selectedName) recurrenceObserver.observe(selectedName, observeOptions);
}

function queueApply() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    recurrenceObserver?.disconnect();
    try { applyFloodRecurrenceMeaning(); }
    finally { reconnectObserver(); }
  });
}

recurrenceObserver = new MutationObserver(queueApply);
reconnectObserver();
setTimeout(queueApply, 300);

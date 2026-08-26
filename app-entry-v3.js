const MIGRATION_KEY = 'thaiflood:ddpm-cache-schema';
const TARGET_VERSION = '4';

try {
  if (localStorage.getItem(MIGRATION_KEY) !== TARGET_VERSION) {
    const prefixes = ['thaiflood:ddpm-fast:', 'thaiflood:ddpm-fast:v2:'];
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && prefixes.some(prefix => key.startsWith(prefix))) localStorage.removeItem(key);
    }
    localStorage.setItem(MIGRATION_KEY, TARGET_VERSION);
  }
} catch {}

await import('/app-base.js?v=20260826-recurrence-v4');

function selectedOfficialData() {
  const name = document.querySelector('#selectedName')?.textContent?.trim();
  return name && window.__tfOfficial ? window.__tfOfficial[name] : null;
}

function clarifyOfficialYearMeaning() {
  const data = selectedOfficialData();
  if (!data?.ok) return;
  const sm = data.summary || {};
  const confirmed = sm.confirmedAreaYears ?? sm.officialYearsWithRecords;
  const start = data.coverage?.start || 2563;
  const end = data.coverage?.end || 2567;

  const badge = document.querySelector('#recurrenceBadge');
  if (badge) badge.innerHTML = `<small>ปีที่มีข้อมูลระดับอำเภอ ปภ.</small><strong>${confirmed ?? '—'}</strong><span>ปี / ${start}–${end}</span>`;

  const recurrence = document.querySelector('#metricRecurrence');
  if (recurrence) {
    recurrence.textContent = confirmed ?? 'ไม่มีข้อมูล';
    const card = recurrence.parentElement;
    const label = card?.querySelector('span');
    const note = card?.querySelector('small');
    if (label) label.textContent = 'ปีที่มีข้อมูลระดับอำเภอ';
    if (note) note.textContent = `รายละเอียดพื้นที่ ปภ. ${start}–${end}`;
  }

  const officialYears = document.querySelector('#officialYears');
  if (officialYears) {
    officialYears.textContent = confirmed ?? 'ไม่มีข้อมูล';
    const label = officialYears.parentElement?.querySelector('span');
    if (label) label.textContent = 'ปีที่มีข้อมูลระดับอำเภอ';
  }

  const insight = document.querySelector('#patternInsight');
  if (insight) {
    const districtCount = Number(sm.districtCount || 0);
    const summaryYears = Array.isArray(sm.provinceSummaryYears) ? sm.provinceSummaryYears : [];
    const separated = summaryYears.length ? ` ข้อมูลปี ${summaryYears.slice().sort().join(' และ ')} เป็นข้อมูลสรุประดับจังหวัด จึงแยกออกจากจำนวนปีด้านบน` : '';
    insight.textContent = confirmed
      ? `พบข้อมูลอุทกภัยที่ระบุพื้นที่ระดับอำเภอ ${confirmed} ปี${districtCount ? ` ครอบคลุมสูงสุด ${districtCount.toLocaleString('th-TH')} อำเภอ` : ''}.${separated}`
      : `ไม่พบข้อมูลอุทกภัยที่ยืนยันพื้นที่ระดับอำเภอในช่วง ${start}–${end}.${separated}`;
  }
}

let queued = false;
function queueClarify() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    clarifyOfficialYearMeaning();
  });
}

const provinceModal = document.querySelector('#provinceModal');
if (provinceModal) new MutationObserver(queueClarify).observe(provinceModal, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['hidden'] });
setTimeout(queueClarify, 300);

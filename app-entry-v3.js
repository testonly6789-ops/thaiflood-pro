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
  const desiredBadge = `<small>ปีที่มีข้อมูลระดับอำเภอ ปภ.</small><strong>${confirmed ?? '—'}</strong><span>ปี / ${start}–${end}</span>`;
  if (badge && badge.innerHTML !== desiredBadge) badge.innerHTML = desiredBadge;

  const recurrence = document.querySelector('#metricRecurrence');
  if (recurrence) {
    recurrence.textContent = confirmed ?? 'ไม่มีข้อมูล';
    const card = recurrence.parentElement;
    const label = card?.querySelector('span');
    const note = card?.querySelector('small');
    if (label && label.textContent !== 'ปีที่มีข้อมูลระดับอำเภอ') label.textContent = 'ปีที่มีข้อมูลระดับอำเภอ';
    const desiredNote = `รายละเอียดพื้นที่ ปภ. ${start}–${end}`;
    if (note && note.textContent !== desiredNote) note.textContent = desiredNote;
  }

  const officialYears = document.querySelector('#officialYears');
  if (officialYears) {
    officialYears.textContent = confirmed ?? 'ไม่มีข้อมูล';
    const label = officialYears.parentElement?.querySelector('span');
    if (label && label.textContent !== 'ปีที่มีข้อมูลระดับอำเภอ') label.textContent = 'ปีที่มีข้อมูลระดับอำเภอ';
  }
}

const badge = document.querySelector('#recurrenceBadge');
const selectedName = document.querySelector('#selectedName');
const observeOptions = { subtree:true, childList:true, characterData:true };
let queued = false;
let clarifyObserver = null;

function reconnectObserver() {
  if (!clarifyObserver) return;
  if (badge) clarifyObserver.observe(badge, observeOptions);
  if (selectedName) clarifyObserver.observe(selectedName, observeOptions);
}

function queueClarify() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    clarifyObserver?.disconnect();
    try { clarifyOfficialYearMeaning(); }
    finally { reconnectObserver(); }
  });
}

clarifyObserver = new MutationObserver(queueClarify);
reconnectObserver();
setTimeout(queueClarify, 300);

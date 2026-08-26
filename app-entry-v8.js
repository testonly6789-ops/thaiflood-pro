// Final guardrail for the national recurrence dashboard.
// Keep the existing visual theme; only correct semantics, labels, and marker scaling.

function recurrenceTargets() {
  return [
    ...document.querySelectorAll('#headlineStats article:nth-child(-n+3)'),
    document.querySelector('.quick-hotspots-card'),
    document.querySelector('.analytics-card'),
    document.querySelector('.map-card'),
    document.querySelector('.ranking-card'),
  ].filter(Boolean);
}

function hideRecurrenceUi() {
  recurrenceTargets().forEach(el => { el.style.visibility = 'hidden'; });
}

function patchStaticCopyEarly() {
  const eyebrow = document.querySelector('.hero .eyebrow');
  if (eyebrow) eyebrow.textContent = 'FLOOD PATTERN INTELLIGENCE • พื้นที่เทียบได้ 2563–2567';

  const heroP = document.querySelector('.hero-copy-wrap > p:last-child');
  if (heroP) heroP.innerHTML = 'ระบบนี้ตอบว่า <b>“พื้นที่เดิมท่วมซ้ำที่ไหน — ซ้ำกี่ปี — จังหวัดใดมีพื้นที่ซ้ำมาก”</b> โดยวัดจากอำเภอเดิมที่มีรายงานอุทกภัยอย่างน้อย 2 ปี และใช้ฝนล่าสุดเป็นสัญญาณเสริม';

  const mapCard = document.querySelector('.map-card .section-head > div:first-child');
  if (mapCard) {
    const h2 = mapCard.querySelector('h2');
    const p = mapCard.querySelector('p:not(.kicker)');
    if (h2) h2.textContent = 'แผนที่พื้นที่ “ท่วมซ้ำ” ระดับอำเภอ';
    if (p) p.textContent = 'แต่ละจุด = จังหวัด • ขนาดจุด = จำนวนอำเภอเดิมที่ท่วมซ้ำ ≥2 ปี • พ.ศ. 2563–2567';
  }

  const rankingCard = document.querySelector('.ranking-card .section-head > div:first-child');
  if (rankingCard) {
    const h2 = rankingCard.querySelector('h2');
    const p = rankingCard.querySelector('p:not(.kicker)');
    if (h2) h2.textContent = 'จังหวัดที่มีพื้นที่ท่วมซ้ำมากที่สุด';
    if (p) p.textContent = 'เรียงจากจำนวนอำเภอเดิมที่มีรายงานอุทกภัยซ้ำตั้งแต่ 2 ปีขึ้นไป';
  }

  const analyticsP = document.querySelector('.analytics-card .section-head p:not(.kicker)');
  if (analyticsP) analyticsP.textContent = 'จัดอันดับจากจำนวนอำเภอเดิมที่มีรายงานน้ำท่วมซ้ำตั้งแต่ 2 ปีขึ้นไป';

  const select = document.querySelector('#frequencyFilter');
  const label = select?.closest('label');
  if (label?.firstChild?.nodeType === Node.TEXT_NODE) label.firstChild.textContent = 'จำนวนอำเภอท่วมซ้ำ';
  select?.querySelectorAll('option').forEach(option => {
    if (option.value === 'all') option.textContent = 'ทั้งหมด';
    else option.textContent = `${option.value} อำเภอขึ้นไป`;
  });
}

hideRecurrenceUi();
patchStaticCopyEarly();

await import('/app-entry-v7.js?v=20260826-dashboard-spatial-final1');

function historyColor(n) {
  if (n >= 18) return '#c93648';
  if (n >= 10) return '#e96c35';
  if (n >= 5) return '#e5a721';
  return '#7f8d9a';
}

function scaledRadius(n) {
  return Math.max(7, Math.min(24, 6 + Math.sqrt(Math.max(0, n)) * 3));
}

function patchHistoryMapMarkers() {
  if (!document.querySelector('#mapModeHistory')?.classList.contains('active')) return;
  document.querySelectorAll('#historyMap .leaflet-overlay-pane circle').forEach(circle => {
    if (circle.dataset.tfSpatialMarker === '1') return;
    const oldRadius = Number(circle.getAttribute('r'));
    if (!Number.isFinite(oldRadius)) return;

    // app-core legacy radius: max(7, 7 + ((count - 3) * 2.5)).
    // r=7 is the legacy floor for counts 1-3; all other values can be inverted exactly.
    const count = oldRadius <= 7.01 ? 3 : Math.max(0, Math.round((oldRadius + 0.5) / 2.5));
    circle.setAttribute('r', scaledRadius(count).toFixed(1));
    circle.setAttribute('fill', historyColor(count));
    circle.dataset.tfSpatialMarker = '1';
  });
}

function patchFilterCopy() {
  const select = document.querySelector('#frequencyFilter');
  const label = select?.closest('label');
  if (label?.firstChild?.nodeType === Node.TEXT_NODE && label.firstChild.textContent !== 'จำนวนอำเภอท่วมซ้ำ') {
    label.firstChild.textContent = 'จำนวนอำเภอท่วมซ้ำ';
  }
  select?.querySelectorAll('option').forEach(option => {
    const next = option.value === 'all' ? 'ทั้งหมด' : `${option.value} อำเภอขึ้นไป`;
    if (option.textContent !== next) option.textContent = next;
  });
}

let queued = false;
function patchFinalUi() {
  queued = false;
  patchStaticCopyEarly();
  patchFilterCopy();
  patchHistoryMapMarkers();
}
function queueFinalUi() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(patchFinalUi);
}

const finalObserver = new MutationObserver(queueFinalUi);
const mapRoot = document.querySelector('#historyMap');
if (mapRoot) finalObserver.observe(mapRoot, { subtree:true, childList:true });
const filterRoot = document.querySelector('.compact-filter-card');
if (filterRoot) finalObserver.observe(filterRoot, { subtree:true, childList:true, characterData:true });

document.querySelector('#mapModeHistory')?.addEventListener('click', () => setTimeout(queueFinalUi, 0));
setTimeout(queueFinalUi, 0);
setTimeout(queueFinalUi, 300);
setTimeout(queueFinalUi, 1200);

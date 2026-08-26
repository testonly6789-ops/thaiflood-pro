const SPATIAL_CACHE_KEY = 'thaiflood:spatial-recurrence-schema';
const SPATIAL_CACHE_VERSION = 'v1-district-repeat';

try {
  if (localStorage.getItem(SPATIAL_CACHE_KEY) !== SPATIAL_CACHE_VERSION) {
    const prefixes = ['thaiflood:ddpm-fast:', 'thaiflood:ddpm-fast:v2:', 'thaiflood:ddpm-fast:v3:', 'thaiflood:ddpm-fast:v4:'];
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && prefixes.some(prefix => key.startsWith(prefix))) localStorage.removeItem(key);
    }
    localStorage.setItem(SPATIAL_CACHE_KEY, SPATIAL_CACHE_VERSION);
  }
} catch {}

await import('/app-entry-v4.js?v=20260826-spatial1');

// Stop the older province-wide recurrence observers from writing into the same
// elements. The legacy code looks up the old IDs on each run; renaming them
// makes this spatial layer the only owner of these fields.
const badge = document.querySelector('#recurrenceBadge');
if (badge) badge.id = 'spatialRecurrenceBadge';
const metric = document.querySelector('#metricRecurrence');
if (metric) metric.id = 'metricSpatialRecurrence';
const officialYears = document.querySelector('#officialYears');
if (officialYears) officialYears.id = 'officialSpatialRecurrence';
const yearMatrix = document.querySelector('#yearMatrix');
if (yearMatrix) yearMatrix.id = 'spatialYearMatrix';
const patternInsight = document.querySelector('#patternInsight');
if (patternInsight) patternInsight.id = 'spatialPatternInsight';
const confidenceLabel = document.querySelector('#confidenceLabel');
if (confidenceLabel) confidenceLabel.id = 'spatialConfidenceLabel';
const confidenceText = document.querySelector('#confidenceText');
if (confidenceText) confidenceText.id = 'spatialConfidenceText';

function selectedName() {
  const name = document.querySelector('#selectedName')?.textContent?.trim();
  return name && name !== '—' ? name : null;
}

function selectedData() {
  const name = selectedName();
  return name ? window.__tfOfficial?.[name] : null;
}

function fmtYears(years) {
  return (years || []).map(Number).filter(Number.isFinite).sort((a,b)=>a-b).join(', ');
}

function renderSpatialMatrix(data) {
  const box = document.querySelector('#spatialYearMatrix');
  if (!box || !data) return;
  const provinceYears = new Set((data.summary?.floodYearList || []).map(Number));
  [...box.querySelectorAll('.year-cell')].forEach((cell, i) => {
    const suffix = Number(cell.querySelector('b')?.textContent);
    const year = Number.isFinite(suffix) ? 2500 + suffix : 2562 + i;
    const span = cell.querySelector('span');
    const found = provinceYears.has(year);
    if (span) span.textContent = found ? 'มีรายงาน' : 'ไม่พบ';
    cell.title = found
      ? `พ.ศ. ${year} มีรายงานอุทกภัยระดับจังหวัดในชุดข้อมูล ปภ.`
      : `พ.ศ. ${year} ไม่พบรายงานอุทกภัยของจังหวัดในชุดข้อมูลที่เชื่อมต่อ`;
  });
}

function renderRecurringHotspots(data) {
  const box = document.querySelector('#hotspotTags');
  if (!box || !data) return;
  const ranking = data.spatialRecurrence?.ranking || data.summary?.spatialRepeatTop || [];
  const recurring = ranking.filter(x => Number(x.yearCount || 0) >= 2).slice(0,6);
  if (!recurring.length) {
    box.innerHTML = '<span class="empty-text">ไม่พบอำเภอเดิมที่มีรายงานซ้ำตั้งแต่ 2 ปีขึ้นไป</span>';
    return;
  }
  box.innerHTML = recurring.map(x => `<span class="tag emphasis">${x.district} • ${x.yearCount} ปี</span>`).join('');
}

function applySpatialRecurrence() {
  const data = selectedData();
  const badgeEl = document.querySelector('#spatialRecurrenceBadge');
  const metricEl = document.querySelector('#metricSpatialRecurrence');
  if (!badgeEl || !metricEl) return;

  if (!data?.ok || !data?.spatialRecurrence) {
    badgeEl.innerHTML = '<small>พื้นที่ท่วมซ้ำ</small><strong style="font-size:17px;line-height:1.25">กำลังวิเคราะห์</strong><span>เทียบอำเภอเดิมรายปี</span>';
    return;
  }

  const spatial = data.spatialRecurrence;
  const maxYears = Number(spatial.maxYears || 0);
  const checked = Number(spatial.checkedYearCount || data.summary?.spatialRepeatCheckedYears || 0);
  const top = spatial.topDistricts || data.summary?.spatialRepeatDistricts || [];
  const ranking = spatial.ranking || [];
  const topNames = top.slice(0,3);
  const more = top.length > topNames.length ? ` +อีก ${top.length - topNames.length}` : '';
  const coverage = spatial.checkedYears?.length ? fmtYears(spatial.checkedYears) : '2563–2567';

  if (maxYears >= 2 && topNames.length) {
    badgeEl.innerHTML = `<small>พื้นที่ท่วมซ้ำสูงสุด</small><strong style="font-size:22px;line-height:1.15">${maxYears} ปี</strong><span>${topNames.join(' • ')}${more}</span>`;
    badgeEl.title = `นับปีที่อำเภอเดิมมีรายงานอุทกภัยซ้ำ จาก ${checked} ปีที่มีข้อมูลชื่ออำเภอเปรียบเทียบได้`;
    metricEl.textContent = `${maxYears} ปี`;
    const card = metricEl.parentElement;
    const label = card?.querySelector('span');
    const note = card?.querySelector('small');
    if (label) label.textContent = 'อำเภอเดิมที่มีรายงานท่วมซ้ำสูงสุด';
    if (note) note.textContent = `${topNames.join(' • ')}${more} • เทียบ ${checked} ปี`;
  } else {
    badgeEl.innerHTML = `<small>พื้นที่ท่วมซ้ำ</small><strong style="font-size:18px;line-height:1.2">ไม่พบซ้ำ ≥2 ปี</strong><span>จาก ${checked || 5} ปีที่เทียบพื้นที่ได้</span>`;
    metricEl.textContent = 'ไม่พบ';
    const card = metricEl.parentElement;
    const label = card?.querySelector('span');
    const note = card?.querySelector('small');
    if (label) label.textContent = 'อำเภอเดิมที่มีรายงานท่วมซ้ำ';
    if (note) note.textContent = `ไม่พบอำเภอเดิมซ้ำตั้งแต่ 2 ปี • เทียบ ${checked || 5} ปี`;
  }

  const official = document.querySelector('#officialSpatialRecurrence');
  if (official) {
    official.textContent = maxYears >= 2 ? `${maxYears} ปี` : 'ไม่พบ';
    const card = official.parentElement;
    const label = card?.querySelector('span');
    const note = card?.querySelector('small');
    if (label) label.textContent = 'พื้นที่เดิมท่วมซ้ำสูงสุด';
    if (note) note.textContent = `ระดับอำเภอ • พ.ศ. ${coverage}`;
  }

  const insight = document.querySelector('#spatialPatternInsight');
  if (insight) {
    const leaders = ranking.filter(x => Number(x.yearCount || 0) >= 2).slice(0,3);
    insight.textContent = leaders.length
      ? `พื้นที่ท่วมซ้ำวัดจาก “อำเภอเดิม” ที่มีรายงานอุทกภัยในหลายปี โดยใช้ปีที่มีชื่ออำเภอเทียบกันได้ พ.ศ. ${coverage}. สูงสุด: ${leaders.map(x => `${x.district} ${x.yearCount} ปี (${fmtYears(x.years)})`).join(' • ')}`
      : `ไม่พบอำเภอเดิมที่มีรายงานอุทกภัยซ้ำตั้งแต่ 2 ปีขึ้นไปในช่วงข้อมูลระดับอำเภอ พ.ศ. ${coverage}`;
  }

  const confLabel = document.querySelector('#spatialConfidenceLabel');
  const confText = document.querySelector('#spatialConfidenceText');
  if (confLabel) confLabel.textContent = 'นิยาม “ท่วมซ้ำซาก” ในหน้านี้';
  if (confText) confText.textContent = `นับเฉพาะอำเภอเดิมที่มีรายงานอุทกภัยซ้ำคนละปี ใช้ข้อมูลระดับอำเภอ พ.ศ. ${coverage}. ปี 2562 และ 2568 เป็นข้อมูลสรุประดับจังหวัด จึงไม่ถูกนำมานับความซ้ำซากของพื้นที่เดิม`;

  renderSpatialMatrix(data);
  renderRecurringHotspots(data);
}

let queued = false;
let spatialObserver = null;
function queueSpatial() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    spatialObserver?.disconnect();
    try { applySpatialRecurrence(); }
    finally { spatialObserver?.observe(document.body,{subtree:true,childList:true,characterData:true}); }
  });
}

spatialObserver = new MutationObserver(queueSpatial);
spatialObserver.observe(document.body,{subtree:true,childList:true,characterData:true});
setTimeout(queueSpatial,50);
setTimeout(queueSpatial,500);
setTimeout(queueSpatial,1600);

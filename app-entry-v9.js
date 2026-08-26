// Do not reveal recurrence-dependent UI until the browser itself confirms the
// final semantic rewrite, ranking, chart, and map-marker scale are all in place.
const guardStyle = document.createElement('style');
guardStyle.id = 'tfSpatialReadinessGuard';
guardStyle.textContent = `
#headlineStats article:nth-child(-n+3),
.quick-hotspots-card,
.analytics-card,
.map-card,
.ranking-card { visibility:hidden!important; }
`;
document.head.appendChild(guardStyle);

await import('/app-entry-v8.js?v=20260826-dashboard-spatial-final3');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function dashboardReady() {
  const payload = window.__tfNationalSpatial;
  if (!payload?.ok || Number(payload.checkedProvinceCount) !== 77 || Number(payload.failedProvinceCount) !== 0) return false;
  if (Number(payload.totalRecurringDistricts) !== 816 || Number(payload.maxYears) !== 5) return false;
  if (payload.topProvince?.province !== 'นครราชสีมา' || Number(payload.topProvince?.recurringDistrictCount) !== 31) return false;

  const cards = [...document.querySelectorAll('#headlineStats article')];
  const headlineOk = cards[0]?.querySelector('strong')?.textContent?.replace(/,/g,'').trim() === '816'
    && cards[1]?.querySelector('strong')?.textContent?.trim() === '5'
    && cards[2]?.querySelector('strong')?.textContent?.trim() === 'นครราชสีมา';
  if (!headlineOk) return false;

  const firstRank = document.querySelector('#rankingList .rank-row b')?.textContent?.trim();
  const firstPill = document.querySelector('#rankingList .rank-row .freq-pill')?.textContent || '';
  if (firstRank !== 'นครราชสีมา' || !firstPill.includes('31')) return false;

  const chart = window.Chart?.getChart?.('recurrenceChart');
  const chartLabel = chart?.data?.labels?.[0];
  const chartValue = Number(chart?.data?.datasets?.[0]?.data?.[0]);
  if (chartLabel !== 'นครราชสีมา' || chartValue !== 31) return false;

  if (document.querySelector('#mapModeHistory')?.classList.contains('active')) {
    const qc = window.__tfMapRadiusQC || {};
    const records = Object.values(qc);
    if (records.length !== 77) return false;
    const radii = records.map(x => Number(x.radius)).filter(Number.isFinite);
    if (radii.length !== 77 || Math.max(...radii) > 24.1 || Math.min(...radii) < 6.9) return false;
    if (Number(qc['นครราชสีมา']?.count) !== 31 || Number(qc['บึงกาฬ']?.count) !== 1) return false;
  }

  const filterOptions = [...document.querySelectorAll('#frequencyFilter option')].map(x => x.textContent || '');
  if (filterOptions.some((text, i) => i > 0 && !text.includes('อำเภอ'))) return false;

  const mapText = document.querySelector('.map-card .section-head')?.textContent || '';
  if (mapText.includes('ประวัติ 11 ปี') || mapText.includes('จำนวนครั้งที่บันทึก')) return false;

  return true;
}

let ready = false;
for (let i = 0; i < 120; i += 1) {
  if (dashboardReady()) { ready = true; break; }
  await sleep(100);
}

if (ready) {
  guardStyle.remove();
} else {
  const banner = document.querySelector('#errorBanner');
  const text = document.querySelector('#errorText');
  if (banner) banner.hidden = false;
  if (text) text.textContent = 'ระบบตรวจความถูกต้องของตัวเลขพื้นที่ท่วมซ้ำยังไม่ผ่าน จึงซ่อนส่วนวิเคราะห์ไว้แทนการแสดงค่าที่อาจผิด';
  console.error('ThaiFlood recurrence dashboard readiness QC failed');
}

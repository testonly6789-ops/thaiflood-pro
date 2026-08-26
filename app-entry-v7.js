await import('/app-entry-v6.js?v=20260826-spatial-dashboard-base');

const previousFetch = window.fetch.bind(window);
let spatialPayload = null;
let spatialMap = new Map();
let spatialReady = false;

function rebuildSpatialMap(payload) {
  spatialPayload = payload;
  spatialMap = new Map((payload?.provinces || []).map(x => [x.province, x]));
  window.__tfNationalSpatial = payload;
}

async function loadSpatialIndex(force = false) {
  const url = `/api/spatial-index${force ? `?t=${Date.now()}` : ''}`;
  const r = await previousFetch(url, { cache:force ? 'no-store' : 'default' });
  const data = await r.json();
  if (!r.ok || !data?.provinces) throw new Error(data?.error || 'โหลดข้อมูลพื้นที่ท่วมซ้ำไม่สำเร็จ');
  rebuildSpatialMap(data);
  return data;
}

function rewriteHistory(data) {
  if (!data?.ok || !spatialMap.size) return data;
  const provinces = (data.provinces || []).map(p => {
    const s = spatialMap.get(p.name);
    if (!s?.ok) return { ...p, recurrence:null, spatialRecurrence:null };
    return {
      ...p,
      recurrence:Number(s.recurringDistrictCount || 0),
      hotspots:(s.ranking || []).map(x => x.district).slice(0,4),
      spatialRecurrence:{
        recurringDistrictCount:Number(s.recurringDistrictCount || 0),
        maxYears:Number(s.maxYears || 0),
        checkedYears:Number(s.checkedYears || 0),
        checkedYearList:s.checkedYearList || [],
        topDistricts:s.topDistricts || [],
        ranking:s.ranking || [],
      },
    };
  });
  const ranked = provinces
    .filter(p => Number(p.spatialRecurrence?.recurringDistrictCount || 0) > 0)
    .sort((a,b) => Number(b.spatialRecurrence?.recurringDistrictCount || 0) - Number(a.spatialRecurrence?.recurringDistrictCount || 0)
      || Number(b.spatialRecurrence?.maxYears || 0) - Number(a.spatialRecurrence?.maxYears || 0)
      || a.name.localeCompare(b.name,'th'));
  return { ...data, provinces, ranked, window:{ start:2563, end:2567, years:5 } };
}

window.fetch = async (input, init) => {
  try {
    const raw = typeof input === 'string' ? input : input?.url;
    if (raw) {
      const u = new URL(raw, location.origin);
      if (u.pathname === '/api/history' && spatialMap.size) {
        const r = await previousFetch(input, init);
        if (!r.ok) return r;
        const data = await r.clone().json();
        return new Response(JSON.stringify(rewriteHistory(data)), { status:r.status, headers:{ 'Content-Type':'application/json; charset=utf-8' } });
      }
    }
  } catch {}
  return previousFetch(input, init);
};

function fmt(n) { return Number(n || 0).toLocaleString('th-TH'); }

function spatialFor(name) { return spatialMap.get(name) || null; }

function patchStaticCopy() {
  const eyebrow = document.querySelector('.hero .eyebrow');
  if (eyebrow) eyebrow.textContent = 'FLOOD PATTERN INTELLIGENCE • พื้นที่เทียบได้ 2563–2567';
  const heroP = document.querySelector('.hero-copy-wrap > p:last-child');
  if (heroP) heroP.innerHTML = 'ระบบนี้ตอบว่า <b>“พื้นที่เดิมท่วมซ้ำที่ไหน — ซ้ำกี่ปี — จังหวัดใดมีพื้นที่ซ้ำมาก”</b> โดยวัดจากอำเภอเดิมที่มีรายงานอุทกภัยอย่างน้อย 2 ปี และใช้ฝนล่าสุดเป็นสัญญาณเสริม';
  const analyticsP = document.querySelector('.analytics-card .section-head p:not(.kicker)');
  if (analyticsP) analyticsP.textContent = 'จัดอันดับจากจำนวนอำเภอเดิมที่มีรายงานน้ำท่วมซ้ำตั้งแต่ 2 ปีขึ้นไป';
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
}

function patchHeadline() {
  if (!spatialPayload) return;
  const cards = [...document.querySelectorAll('#headlineStats article')];
  if (cards[0]) {
    const label = cards[0].querySelector('span');
    const value = cards[0].querySelector('strong');
    const small = cards[0].querySelector('small');
    if (label) label.textContent = 'พื้นที่ท่วมซ้ำซากที่ยืนยันได้';
    if (value) value.textContent = fmt(spatialPayload.totalRecurringDistricts);
    if (small) small.textContent = 'อำเภอ • ซ้ำอย่างน้อย 2 ปี';
  }
  if (cards[1]) {
    const label = cards[1].querySelector('span');
    const value = cards[1].querySelector('strong');
    const small = cards[1].querySelector('small');
    if (label) label.textContent = 'ความถี่พื้นที่เดิมสูงสุด';
    if (value) value.textContent = fmt(spatialPayload.maxYears);
    if (small) small.textContent = 'ปี / 5 ปีที่เปรียบเทียบได้';
  }
  const top = spatialPayload.topProvince;
  if (cards[2] && top) {
    const label = cards[2].querySelector('span');
    const value = cards[2].querySelector('strong');
    const small = cards[2].querySelector('small');
    if (label) label.textContent = 'จังหวัดที่มีพื้นที่ท่วมซ้ำมากสุด';
    if (value) value.textContent = top.province;
    if (small) small.textContent = `${fmt(top.recurringDistrictCount)} อำเภอท่วมซ้ำ • สูงสุด ${fmt(top.maxYears)} ปี`;
  }
}

function patchChipsAndRanking() {
  document.querySelectorAll('.hotspot-chip').forEach(btn => {
    const name = btn.querySelector('span')?.textContent?.trim();
    const s = spatialFor(name);
    const small = btn.querySelector('small');
    if (s && small) small.textContent = `${fmt(s.recurringDistrictCount)} อำเภอท่วมซ้ำ`;
  });
  document.querySelectorAll('.rank-row').forEach(row => {
    const name = row.querySelector('b')?.textContent?.trim();
    const s = spatialFor(name);
    const pill = row.querySelector('.freq-pill');
    const meta = row.querySelector('span:nth-child(2) small');
    if (s && pill) pill.textContent = `${fmt(s.recurringDistrictCount)} อำเภอ`;
    if (s && meta) {
      const districts = (s.ranking || []).slice(0,3).map(x => x.district);
      meta.textContent = `สูงสุด ${fmt(s.maxYears)} ปี${districts.length ? ` • ${districts.join(' • ')}` : ''}`;
    }
  });
}

function patchMapPopups() {
  document.querySelectorAll('.map-popup').forEach(popup => {
    const name = popup.querySelector('h4')?.textContent?.trim();
    const s = spatialFor(name);
    const p = popup.querySelector('p');
    if (s && p && !p.textContent.includes('ดัชนีฝน')) {
      p.textContent = `${fmt(s.recurringDistrictCount)} อำเภอท่วมซ้ำ • พื้นที่เดิมสูงสุด ${fmt(s.maxYears)} ปี / ${fmt(s.checkedYears || 5)} ปีที่เทียบได้`;
    }
  });
}

function patchChart() {
  if (!window.Chart) return;
  const chart = window.Chart.getChart?.('recurrenceChart');
  if (!chart) return;
  chart.data.datasets[0].label = 'จำนวนอำเภอท่วมซ้ำ';
  chart.options.plugins.tooltip.callbacks.label = ctx => `${ctx.raw} อำเภอท่วมซ้ำ`;
  chart.update('none');
}

let patchQueued = false;
function patchDashboard() {
  patchQueued = false;
  if (!spatialReady) return;
  patchStaticCopy();
  patchHeadline();
  patchChipsAndRanking();
  patchMapPopups();
  patchChart();
}
function queuePatch() {
  if (patchQueued) return;
  patchQueued = true;
  requestAnimationFrame(patchDashboard);
}

const observer = new MutationObserver(queuePatch);
observer.observe(document.body,{subtree:true,childList:true,characterData:true});

try {
  await loadSpatialIndex(false);
  spatialReady = true;
  patchDashboard();
  setTimeout(() => document.querySelector('#refreshBtn')?.click(), 50);
  setTimeout(patchDashboard, 400);
  setTimeout(patchDashboard, 1400);
} catch (error) {
  console.error('Spatial dashboard index failed', error);
}

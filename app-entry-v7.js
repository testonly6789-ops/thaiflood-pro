await import('/app-entry-v6.js?v=20260826-spatial-dashboard-base');

const previousFetch = window.fetch.bind(window);
let spatialPayload = null;
let spatialMap = new Map();
let spatialReady = false;
let observer = null;

function setSpatialUiPending(pending) {
  const targets = [
    ...document.querySelectorAll('#headlineStats article:nth-child(-n+3)'),
    document.querySelector('.quick-hotspots-card'),
    document.querySelector('.analytics-card'),
    document.querySelector('.map-card'),
    document.querySelector('.ranking-card'),
  ].filter(Boolean);
  targets.forEach(el => { el.style.visibility = pending ? 'hidden' : ''; });
}

function showSpatialFailure(message) {
  setSpatialUiPending(true);
  const banner = document.querySelector('#errorBanner');
  const text = document.querySelector('#errorText');
  if (banner) banner.hidden = false;
  if (text) text.textContent = message || 'ข้อมูลพื้นที่ท่วมซ้ำระดับอำเภอยังตรวจไม่ครบ จึงซ่อนตัวเลขส่วนนี้เพื่อไม่แสดงผลผิด';
}

setSpatialUiPending(true);

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
  if (!data.ok || Number(data.failedProvinceCount || 0) > 0 || Number(data.checkedProvinceCount || 0) !== Number(data.provinceCount || 77)) {
    throw new Error(`ตรวจข้อมูลพื้นที่ท่วมซ้ำไม่ครบ ${data.checkedProvinceCount || 0}/${data.provinceCount || 77} จังหวัด`);
  }
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
  if (eyebrow && eyebrow.textContent !== 'FLOOD PATTERN INTELLIGENCE • พื้นที่เทียบได้ 2563–2567') eyebrow.textContent = 'FLOOD PATTERN INTELLIGENCE • พื้นที่เทียบได้ 2563–2567';
  const heroP = document.querySelector('.hero-copy-wrap > p:last-child');
  const heroHtml = 'ระบบนี้ตอบว่า <b>“พื้นที่เดิมท่วมซ้ำที่ไหน — ซ้ำกี่ปี — จังหวัดใดมีพื้นที่ซ้ำมาก”</b> โดยวัดจากอำเภอเดิมที่มีรายงานอุทกภัยอย่างน้อย 2 ปี และใช้ฝนล่าสุดเป็นสัญญาณเสริม';
  if (heroP && heroP.innerHTML !== heroHtml) heroP.innerHTML = heroHtml;
  const analyticsP = document.querySelector('.analytics-card .section-head p:not(.kicker)');
  if (analyticsP && analyticsP.textContent !== 'จัดอันดับจากจำนวนอำเภอเดิมที่มีรายงานน้ำท่วมซ้ำตั้งแต่ 2 ปีขึ้นไป') analyticsP.textContent = 'จัดอันดับจากจำนวนอำเภอเดิมที่มีรายงานน้ำท่วมซ้ำตั้งแต่ 2 ปีขึ้นไป';
  const mapCard = document.querySelector('.map-card .section-head > div:first-child');
  if (mapCard) {
    const h2 = mapCard.querySelector('h2');
    const p = mapCard.querySelector('p:not(.kicker)');
    if (h2 && h2.textContent !== 'แผนที่พื้นที่ “ท่วมซ้ำ” ระดับอำเภอ') h2.textContent = 'แผนที่พื้นที่ “ท่วมซ้ำ” ระดับอำเภอ';
    if (p && p.textContent !== 'แต่ละจุด = จังหวัด • ขนาดจุด = จำนวนอำเภอเดิมที่ท่วมซ้ำ ≥2 ปี • พ.ศ. 2563–2567') p.textContent = 'แต่ละจุด = จังหวัด • ขนาดจุด = จำนวนอำเภอเดิมที่ท่วมซ้ำ ≥2 ปี • พ.ศ. 2563–2567';
  }
  const rankingCard = document.querySelector('.ranking-card .section-head > div:first-child');
  if (rankingCard) {
    const h2 = rankingCard.querySelector('h2');
    const p = rankingCard.querySelector('p:not(.kicker)');
    if (h2 && h2.textContent !== 'จังหวัดที่มีพื้นที่ท่วมซ้ำมากที่สุด') h2.textContent = 'จังหวัดที่มีพื้นที่ท่วมซ้ำมากที่สุด';
    if (p && p.textContent !== 'เรียงจากจำนวนอำเภอเดิมที่มีรายงานอุทกภัยซ้ำตั้งแต่ 2 ปีขึ้นไป') p.textContent = 'เรียงจากจำนวนอำเภอเดิมที่มีรายงานอุทกภัยซ้ำตั้งแต่ 2 ปีขึ้นไป';
  }
  const freqLabel = document.querySelector('#frequencyFilter')?.closest('label');
  if (freqLabel?.firstChild?.nodeType === Node.TEXT_NODE && freqLabel.firstChild.textContent !== 'จำนวนอำเภอท่วมซ้ำ') freqLabel.firstChild.textContent = 'จำนวนอำเภอท่วมซ้ำ';
}

function patchHeadline() {
  if (!spatialPayload) return;
  const cards = [...document.querySelectorAll('#headlineStats article')];
  if (cards[0]) {
    const label = cards[0].querySelector('span');
    const value = cards[0].querySelector('strong');
    const small = cards[0].querySelector('small');
    if (label && label.textContent !== 'พื้นที่ท่วมซ้ำซากที่ยืนยันได้') label.textContent = 'พื้นที่ท่วมซ้ำซากที่ยืนยันได้';
    if (value && value.textContent !== fmt(spatialPayload.totalRecurringDistricts)) value.textContent = fmt(spatialPayload.totalRecurringDistricts);
    if (small && small.textContent !== 'อำเภอ • ซ้ำอย่างน้อย 2 ปี') small.textContent = 'อำเภอ • ซ้ำอย่างน้อย 2 ปี';
  }
  if (cards[1]) {
    const label = cards[1].querySelector('span');
    const value = cards[1].querySelector('strong');
    const small = cards[1].querySelector('small');
    if (label && label.textContent !== 'ความถี่พื้นที่เดิมสูงสุด') label.textContent = 'ความถี่พื้นที่เดิมสูงสุด';
    if (value && value.textContent !== fmt(spatialPayload.maxYears)) value.textContent = fmt(spatialPayload.maxYears);
    if (small && small.textContent !== 'ปี / 5 ปีที่เปรียบเทียบได้') small.textContent = 'ปี / 5 ปีที่เปรียบเทียบได้';
  }
  const top = spatialPayload.topProvince;
  if (cards[2] && top) {
    const label = cards[2].querySelector('span');
    const value = cards[2].querySelector('strong');
    const small = cards[2].querySelector('small');
    const meta = `${fmt(top.recurringDistrictCount)} อำเภอท่วมซ้ำ • สูงสุด ${fmt(top.maxYears)} ปี`;
    if (label && label.textContent !== 'จังหวัดที่มีพื้นที่ท่วมซ้ำมากสุด') label.textContent = 'จังหวัดที่มีพื้นที่ท่วมซ้ำมากสุด';
    if (value && value.textContent !== top.province) value.textContent = top.province;
    if (small && small.textContent !== meta) small.textContent = meta;
  }
}

function patchChipsAndRanking() {
  document.querySelectorAll('.hotspot-chip').forEach(btn => {
    const name = btn.querySelector('span')?.textContent?.trim();
    const s = spatialFor(name);
    const small = btn.querySelector('small');
    const text = s ? `${fmt(s.recurringDistrictCount)} อำเภอท่วมซ้ำ` : '';
    if (s && small && small.textContent !== text) small.textContent = text;
  });
  document.querySelectorAll('.rank-row').forEach(row => {
    const name = row.querySelector('b')?.textContent?.trim();
    const s = spatialFor(name);
    const pill = row.querySelector('.freq-pill');
    const meta = row.querySelector('span:nth-child(2) small');
    if (!s) return;
    const pillText = `${fmt(s.recurringDistrictCount)} อำเภอ`;
    if (pill && pill.textContent !== pillText) pill.textContent = pillText;
    if (meta) {
      const districts = (s.ranking || []).slice(0,3).map(x => x.district);
      const metaText = `สูงสุด ${fmt(s.maxYears)} ปี${districts.length ? ` • ${districts.join(' • ')}` : ''}`;
      if (meta.textContent !== metaText) meta.textContent = metaText;
    }
  });
}

function patchMapPopups() {
  document.querySelectorAll('.map-popup').forEach(popup => {
    const name = popup.querySelector('h4')?.textContent?.trim();
    const s = spatialFor(name);
    const p = popup.querySelector('p');
    if (s && p && !p.textContent.includes('ดัชนีฝน')) {
      const text = `${fmt(s.recurringDistrictCount)} อำเภอท่วมซ้ำ • พื้นที่เดิมสูงสุด ${fmt(s.maxYears)} ปี / ${fmt(s.checkedYears || 5)} ปีที่เทียบได้`;
      if (p.textContent !== text) p.textContent = text;
    }
  });
}

function patchChart() {
  if (!window.Chart) return;
  const chart = window.Chart.getChart?.('recurrenceChart');
  if (!chart) return;
  let changed = false;
  if (chart.data.datasets[0].label !== 'จำนวนอำเภอท่วมซ้ำ') { chart.data.datasets[0].label = 'จำนวนอำเภอท่วมซ้ำ'; changed = true; }
  const callback = chart.options?.plugins?.tooltip?.callbacks?.label;
  if (!callback || callback.__tfSpatial !== true) {
    const fn = ctx => `${ctx.raw} อำเภอท่วมซ้ำ`;
    fn.__tfSpatial = true;
    chart.options.plugins.tooltip.callbacks.label = fn;
    changed = true;
  }
  if (changed) chart.update('none');
}

let patchQueued = false;
function patchDashboard() {
  patchQueued = false;
  if (!spatialReady) return;
  observer?.disconnect();
  try {
    patchStaticCopy();
    patchHeadline();
    patchChipsAndRanking();
    patchMapPopups();
    patchChart();
  } finally {
    observer?.observe(document.body,{subtree:true,childList:true,characterData:true});
  }
}
function queuePatch() {
  if (patchQueued) return;
  patchQueued = true;
  requestAnimationFrame(patchDashboard);
}

observer = new MutationObserver(queuePatch);
observer.observe(document.body,{subtree:true,childList:true,characterData:true});

try {
  await loadSpatialIndex(false);
  spatialReady = true;
  setSpatialUiPending(false);
  patchDashboard();
  setTimeout(() => document.querySelector('#refreshBtn')?.click(), 50);
  setTimeout(patchDashboard, 400);
  setTimeout(patchDashboard, 1400);
} catch (error) {
  console.error('Spatial dashboard index failed', error);
  showSpatialFailure(error.message);
}

const state = {
  history: [],
  ranked: [],
  weather: [],
  selected: null,
  selectedYear: null,
  recurringOnly: true,
  filters: { region: 'all', freq: 'all', mechanism: 'all' },
  window: { start: 2558, end: 2568, years: 11 },
  map: null,
  markerLayer: null,
  mapMode: 'history',
  officialCache: {},
  charts: { recurrence: null, official: null },
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const fmt = (n, d = 0) => n == null ? '—' : Number(n).toLocaleString('th-TH', { maximumFractionDigits: d, minimumFractionDigits: d > 0 ? d : 0 });
const fmtLoose = (n, d = 0) => n == null ? 'ไม่มีข้อมูลยืนยัน' : Number(n).toLocaleString('th-TH', { maximumFractionDigits: d, minimumFractionDigits: d > 0 ? d : 0 });
const normalize = (s) => (s || '').toString().toLowerCase().trim();
const recurrenceColor = (n) => n >= 7 ? '#c93648' : n >= 5 ? '#e96c35' : n >= 4 ? '#e5a721' : '#7f8d9a';
const recurrenceRadius = (n) => n == null ? 6 : Math.max(7, 7 + ((n - 3) * 2.5));

function getWeather(name) {
  return state.weather.find(x => x.name === name);
}

function mechanismKey(list = []) {
  const s = list.join(' ');
  if (/เมือง|ระบาย/.test(s)) return 'urban';
  if (/ล้นตลิ่ง|แม่น้ำ|ลุ่ม|เจ้าพระยา|ยม|มูล/.test(s)) return 'river';
  if (/น้ำป่า|หลาก|ดินถล่ม|ภูเขา/.test(s)) return 'flash';
  return 'other';
}

function derivedSummary(p) {
  const summary = p.summary || {};
  const events = p.events || [];
  const pick = (key, reducer = 'sum') => {
    if (summary[key] != null) return summary[key];
    const values = events.map(e => e[key]).filter(v => v != null);
    if (!values.length) return null;
    if (reducer === 'max') return Math.max(...values);
    return values.reduce((a, b) => a + Number(b || 0), 0);
  };
  return {
    recurrence: p.recurrence,
    maxWaterM: pick('maxWaterM', 'max'),
    damageM: pick('damageM', 'sum'),
    aidM: pick('aidM', 'sum'),
    agriRai: pick('agriRai', 'sum'),
    households: pick('households', 'sum'),
    cropAidM: pick('cropAidM', 'sum'),
    eventCount: events.length,
  };
}

async function loadAll(force = false) {
  $('#errorBanner').hidden = true;
  $('#refreshBtn').disabled = true;
  try {
    const qs = force ? `?t=${Date.now()}` : '';
    const [historyRes, weatherRes] = await Promise.all([
      fetch(`/api/history${qs}`, { cache: force ? 'no-store' : 'default' }).then(r => r.json()),
      fetch(`/api/forecast${qs}`, { cache: force ? 'no-store' : 'default' }).then(r => r.json()).catch(() => ({ ok: false, provinces: [] })),
    ]);

    if (!historyRes.ok) throw new Error(historyRes.error || 'โหลดข้อมูลประวัติไม่สำเร็จ');
    state.history = historyRes.provinces || [];
    state.ranked = historyRes.ranked || [];
    state.window = historyRes.window || state.window;
    state.weather = weatherRes.ok ? (weatherRes.provinces || []) : [];

    const saved = localStorage.getItem('thaiflood:intel:selected');
    state.selected = state.history.find(x => x.name === saved) || state.history.find(x => x.name === 'เชียงใหม่') || state.ranked[0] || state.history[0];
    state.selectedYear = (state.selected?.events || [])[0]?.year || null;

    renderAll();

    if (!weatherRes.ok) {
      $('#errorBanner').hidden = false;
      $('#errorText').textContent = 'ข้อมูลประวัติทำงานปกติ แต่สัญญาณฝนล่าสุดยังโหลดไม่ได้';
    }
  } catch (e) {
    $('#errorBanner').hidden = false;
    $('#errorText').textContent = e.message || 'กรุณาลองใหม่';
  } finally {
    $('#refreshBtn').disabled = false;
  }
}

function getDisplayRows() {
  const base = state.recurringOnly ? state.ranked.slice() : state.history.slice().sort((a, b) => (b.recurrence || -1) - (a.recurrence || -1) || a.name.localeCompare(b.name, 'th'));
  return base.filter(p => {
    if (state.filters.region !== 'all' && p.region !== state.filters.region) return false;
    if (state.filters.freq !== 'all' && Number(p.recurrence || 0) < Number(state.filters.freq)) return false;
    if (state.filters.mechanism !== 'all' && mechanismKey(p.mechanisms) !== state.filters.mechanism) return false;
    return true;
  });
}

function renderAll() {
  renderStats();
  renderHotspotChips();
  renderRecurrenceChart();
  renderRanking();
  renderMap();
  renderProvince();
  renderSearchResults('');
  $('#yearWindowText').textContent = `${state.window.start} → ${state.window.end}`;
}

function renderStats() {
  const ranked = state.ranked;
  $('#repeatAreaCount').textContent = fmt(ranked.length);
  $('#maxRecurrence').textContent = fmt(Math.max(0, ...ranked.map(x => x.recurrence || 0)));
  $('#topProvince').textContent = ranked[0]?.name || '—';
  $('#topProvinceMeta').textContent = ranked[0] ? `${ranked[0].recurrence} ครั้ง / ${state.window.years} ปี` : '—';
  $('#maxRainToday').textContent = state.weather.length ? fmt(Math.max(...state.weather.map(x => Number(x.rain24 || 0))), 1) : '—';
}

function renderHotspotChips() {
  const box = $('#hotspotChips');
  box.innerHTML = '';
  state.ranked.slice(0, 9).forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hotspot-chip';
    btn.innerHTML = `<span>${p.name}</span><small>${p.recurrence} ครั้ง</small>`;
    btn.onclick = () => selectProvince(p.name, { openModal: true });
    box.appendChild(btn);
  });
}

function renderRecurrenceChart() {
  const canvas = $('#recurrenceChart');
  if (!canvas || !window.Chart) return;
  const rows = state.ranked.slice(0, 10);
  if (state.charts.recurrence) state.charts.recurrence.destroy();
  state.charts.recurrence = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.name),
      datasets: [{ label: 'จำนวนครั้งที่บันทึก', data: rows.map(r => r.recurrence), borderWidth: 0, borderRadius: 8 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display:false }, tooltip:{ callbacks:{ label:(ctx)=>`${ctx.raw} ครั้ง / ${state.window.years} ปี` } } },
      scales: { x: { beginAtZero:true, ticks:{ precision:0 }, grid:{ color:'rgba(20,50,80,.08)' } }, y:{ grid:{ display:false } } }
    }
  });
}

function renderRanking() {
  const box = $('#rankingList');
  box.innerHTML = '';
  const rows = getDisplayRows();
  if (!rows.length) {
    box.innerHTML = '<div class="empty-text">ไม่พบพื้นที่ตามตัวกรอง</div>';
    return;
  }
  rows.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `rank-row ${state.selected?.name === p.name ? 'selected' : ''}`;
    const meta = p.recurrence == null ? 'ยังไม่มีความถี่ในชุดอ้างอิง' : `${p.recurrence} ครั้ง / ${state.window.years} ปี`;
    b.innerHTML = `
      <span class="rank-no">${String(i + 1).padStart(2, '0')}</span>
      <span><b>${p.name}</b><small>ภาค${p.region}${p.hotspots?.length ? ' • ' + p.hotspots.join(', ') : ''}</small></span>
      <span class="freq-pill">${meta}</span>`;
    b.onclick = () => selectProvince(p.name, { openModal: true });
    box.appendChild(b);
  });
}

function ensureMap() {
  if (state.map) return;
  state.map = L.map('historyMap', { zoomControl: true, scrollWheelZoom: false }).setView([15.3, 101.0], 6);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 18,
  }).addTo(state.map);
  state.markerLayer = L.layerGroup().addTo(state.map);
}

function renderMap() {
  ensureMap();
  state.markerLayer.clearLayers();
  const rows = state.mapMode === 'rain'
    ? state.history
    : state.ranked.filter(p => {
        if (state.filters.region !== 'all' && p.region !== state.filters.region) return false;
        if (state.filters.freq !== 'all' && Number(p.recurrence || 0) < Number(state.filters.freq)) return false;
        if (state.filters.mechanism !== 'all' && mechanismKey(p.mechanisms) !== state.filters.mechanism) return false;
        return true;
      });

  rows.forEach((p) => {
    const selected = state.selected?.name === p.name;
    const w = getWeather(p.name);
    const rainScore = Number(w?.score || 0);
    const rainColor = rainScore >= 75 ? '#c93648' : rainScore >= 55 ? '#e96c35' : rainScore >= 30 ? '#e5a721' : '#4da06b';
    const fillColor = state.mapMode === 'rain' ? rainColor : recurrenceColor(p.recurrence);
    const radius = state.mapMode === 'rain' ? Math.max(5, 5 + rainScore / 20) : recurrenceRadius(p.recurrence);
    const marker = L.circleMarker([p.lat, p.lon], {
      radius,
      color: selected ? '#10243e' : '#ffffff',
      weight: selected ? 3 : 2,
      fillColor,
      fillOpacity: .9,
    });
    const popupText = state.mapMode === 'rain'
      ? `ดัชนีฝน ${w ? fmt(w.score) : '—'} / 100 • ฝนวันนี้ ${w ? fmt(w.rain24,1) : '—'} มม.`
      : (p.recurrence == null ? 'ยังไม่มีค่าความถี่ในชุดอ้างอิง' : `ท่วมซ้ำ ${p.recurrence} ครั้ง / ${state.window.years} ปี`);
    marker.bindPopup(`<div class="map-popup"><h4>${p.name}</h4><p>${popupText}</p></div>`);
    marker.on('click', () => selectProvince(p.name, { openModal: true }));
    state.markerLayer.addLayer(marker);
  });

  const thailandBounds = L.latLngBounds([[5.2, 97.0], [20.7, 105.9]]);
  state.map.fitBounds(thailandBounds, { padding: [20, 20] });
}

function renderProvince() {
  const p = state.selected;
  if (!p) return;
  const summary = derivedSummary(p);
  const w = getWeather(p.name);

  $('#selectedName').textContent = p.name;
  $('#selectedRegion').textContent = `ภาค${p.region}`;
  $('#recurrenceBadge').innerHTML = `<small>ท่วมซ้ำ</small><strong>${p.recurrence == null ? '—' : p.recurrence}</strong><span>${p.recurrence == null ? 'ไม่มีข้อมูลยืนยัน' : `ครั้ง / ${state.window.years} ปี`}</span>`;

  $('#metricRecurrence').textContent = p.recurrence == null ? '—' : p.recurrence;
  $('#metricWater').textContent = fmt(summary.maxWaterM, 1);
  $('#metricDamage').textContent = fmt(summary.damageM);
  $('#metricAid').textContent = fmt(summary.aidM);
  $('#metricAgri').textContent = fmt(summary.agriRai);
  $('#metricHouseholds').textContent = fmt(summary.households);
  $('#metricCropAid').textContent = fmt(summary.cropAidM);
  $('#metricEventCount').textContent = fmt(summary.eventCount);

  renderTags($('#hotspotTags'), p.hotspots, true);
  renderTags($('#mechanismTags'), p.mechanisms, false);
  $('#patternInsight').textContent = patternInsight(p, w);
  renderYears(p);
  renderSignals(w);
  renderConfidence(p);
  renderOfficialData(p);
  renderRanking();
  renderMap();
}

function renderTags(el, arr, emphasis = false) {
  el.innerHTML = '';
  if (!arr?.length) {
    el.innerHTML = '<span class="empty-text">ยังไม่มีข้อมูลยืนยันในชุดอ้างอิง</span>';
    return;
  }
  arr.forEach(x => {
    const s = document.createElement('span');
    s.className = `tag ${emphasis ? 'emphasis' : ''}`;
    s.textContent = x;
    el.appendChild(s);
  });
}

function patternInsight(p, w) {
  if (p.insight) {
    let text = p.insight;
    if (w && Number(w.rain3) >= 40) text += ` ขณะเดียวกันฝนสะสม 3 วันล่าสุดอยู่ที่ ${fmt(w.rain3, 1)} มม. จึงควรซ้อนข้อมูลระดับน้ำและทางระบายเพื่อประเมินสถานการณ์ปัจจุบัน`;
    return text;
  }
  if (p.recurrence == null) return 'จังหวัดนี้ยังไม่มีค่าความถี่ที่ยืนยันในชุดข้อมูลต้นแบบ จึงไม่ควรสรุปว่า “ไม่เคยท่วม” ต้องเชื่อมฐานข้อมูลเหตุการณ์จริงเพิ่มเติม';
  let t = `มีการบันทึกน้ำท่วมซ้ำ ${p.recurrence} ครั้งในช่วง ${state.window.years} ปี จึงควรถูกจัดเป็นพื้นที่เฝ้าระวังเชิงประวัติ ไม่ควรรอให้ฝนตกหนักก่อนจึงเริ่มเตรียมการ`;
  if (w && w.rain3 >= 40) t += ` ขณะเดียวกันฝนสะสม 3 วันล่าสุดอยู่ที่ ${fmt(w.rain3, 1)} มม. จึงควรซ้อนข้อมูลระดับน้ำและทางระบายเพื่อประเมินสถานการณ์ปัจจุบัน`;
  return t;
}

function renderYears(p) {
  const box = $('#yearMatrix');
  box.innerHTML = '';
  const events = (p.events || []).slice().sort((a, b) => b.year - a.year);
  if (!state.selectedYear && events[0]) state.selectedYear = events[0].year;
  for (let y = state.window.start; y <= state.window.end; y++) {
    const ev = events.find(e => e.year === y);
    const d = document.createElement('button');
    d.type = 'button';
    d.className = `year-cell ${ev ? 'has-event' : ''} ${state.selectedYear === y ? 'active' : ''}`;
    d.innerHTML = `<b>${String(y).slice(-2)}</b><span>${ev ? 'มีข้อมูล' : '—'}</span>`;
    d.onclick = () => {
      state.selectedYear = y;
      renderYears(p);
      const target = document.getElementById(`event-${y}`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    box.appendChild(d);
  }

  const details = $('#eventDetails');
  details.innerHTML = '';
  if (!events.length) {
    details.innerHTML = '<div class="empty-text">ชุดต้นแบบระบุจำนวนครั้ง แต่ยังไม่ได้เปิดเผยรายละเอียดเหตุการณ์รายปีของจังหวัดนี้ครบทุกเหตุการณ์ — ระบบจึงไม่สร้างปีหรือความเสียหายขึ้นเอง</div>';
    return;
  }

  events.forEach(e => {
    const c = document.createElement('article');
    c.className = 'event-card';
    c.id = `event-${e.year}`;
    const active = state.selectedYear === e.year;
    if (active) c.style.borderColor = '#fdc9d1';
    c.innerHTML = `
      <div class="event-head">
        <div class="event-year">พ.ศ. ${e.year}</div>
        <div class="event-title">
          <b>${e.areas || 'พื้นที่ที่บันทึก'}</b>
          <small>${e.severityLabel || (e.severity === 'critical' ? 'วิกฤต' : 'เหตุการณ์ที่บันทึก')}</small>
        </div>
      </div>
      <div class="event-kpis">
        <article>
          <span>ความเสียหายรวม</span>
          <strong>${fmtLoose(e.damageM)} ล้านบาท</strong>
          <p>${e.households != null ? `ครัวเรือนที่ได้รับผลกระทบ ${fmt(e.households)} ครัวเรือน` : 'หากไม่มีฟิลด์บางตัว ระบบจะไม่เติมเลขแทนเอง'}</p>
        </article>
        <article>
          <span>เกษตรที่ได้รับผลกระทบ</span>
          <strong>${fmtLoose(e.agriRai)} ไร่</strong>
          <p>${e.cropAidM != null ? `งบชดเชยพืช ${fmt(e.cropAidM)} ล้านบาท` : 'ยังไม่มีข้อมูลยืนยันเรื่องงบชดเชยพืช'}</p>
        </article>
      </div>
      <div class="event-note-grid">
        <div class="event-note">
          <h5>พืช/กิจกรรมที่ได้รับผลกระทบหลัก</h5>
          <p>${e.crops || 'ยังไม่มีรายละเอียดพืชหรือกิจกรรมเด่นที่ยืนยันในชุดอ้างอิง'}</p>
        </div>
        <div class="event-note">
          <h5>สาเหตุและลำดับเหตุการณ์</h5>
          <p>${e.cause || 'ยังไม่มีคำอธิบายสาเหตุที่ยืนยันในชุดอ้างอิง'}</p>
        </div>
      </div>
      <div class="event-note-grid">
        <div class="event-note">
          <h5>ผลกระทบเชิงพื้นที่</h5>
          <p>${e.impact || 'ยังไม่มีรายละเอียดผลกระทบเชิงพื้นที่ที่ยืนยันในชุดอ้างอิง'}</p>
        </div>
        <div class="event-note">
          <h5>หมายเหตุ</h5>
          <p>${e.note || 'ข้อมูลนี้ออกแบบให้สามารถต่อยอดเชื่อมฐานข้อมูลทางการได้ในภายหลัง'}</p>
        </div>
      </div>`;
    details.appendChild(c);
  });
}

function renderSignals(w) {
  if (!w) {
    ['rain24', 'rain3', 'rainProb', 'rainScore'].forEach(id => $('#' + id).textContent = '—');
    $('#sevenDayBars').innerHTML = '<span class="empty-text">ยังโหลดสัญญาณฝนล่าสุดไม่ได้</span>';
    return;
  }
  $('#rain24').textContent = fmt(w.rain24, 1);
  $('#rain3').textContent = fmt(w.rain3, 1);
  $('#rainProb').textContent = fmt(w.probability);
  $('#rainScore').textContent = fmt(w.score);

  const values = (w.sevenDayRain || []).slice(0, 7);
  const max = Math.max(10, ...values);
  $('#sevenDayBars').innerHTML = '';
  values.forEach((v, i) => {
    const d = document.createElement('div');
    d.className = 'day';
    const h = Math.max(4, Math.round((v / max) * 114));
    d.innerHTML = `<em>${fmt(v, 1)}</em><div class="bartrack"><div class="barfill" style="height:${h}px"></div></div><small>${i === 0 ? 'วันนี้' : '+' + i + ' วัน'}</small>`;
    $('#sevenDayBars').appendChild(d);
  });
}

function renderConfidence(p) {
  if (p.recurrence != null) {
    $('#confidenceLabel').textContent = (p.events || []).length ? 'มีความถี่ + รายละเอียดเหตุการณ์บางปี' : 'มีความถี่ แต่รายปีไม่ครบ';
    $('#confidenceText').textContent = (p.events || []).length
      ? 'ใช้เพื่อคัดกรองและวิเคราะห์รูปแบบได้ดีขึ้น แต่ยังควรเชื่อมฐานข้อมูลทางการเพิ่มเติมหากจะใช้เชิงปฏิบัติหรือรายงานทางการ'
      : 'มีจำนวนครั้งท่วมซ้ำ แต่รายละเอียดปี/ความเสียหายยังไม่ครบ จึงควรเชื่อมฐานข้อมูล ปภ. / GISTDA / ThaiWater เพิ่ม';
  } else {
    $('#confidenceLabel').textContent = 'ข้อมูลประวัติยังไม่พอ';
    $('#confidenceText').textContent = 'ห้ามตีความค่า “ไม่มีข้อมูล” ว่า “ไม่เคยท่วม” ต้องเพิ่มข้อมูลเหตุการณ์ย้อนหลังของจังหวัดนี้ก่อนใช้ตัดสินใจ';
  }
}

async function renderOfficialData(p) {
  const loading = $('#officialLoading');
  const error = $('#officialError');
  const content = $('#officialContent');
  if (!loading || !error || !content || !p) return;

  error.hidden = true;
  content.hidden = true;
  loading.hidden = false;
  loading.textContent = 'กำลังโหลดข้อมูลทางการจาก ปภ....';

  try {
    let data = state.officialCache[p.name];
    if (!data) {
      const r = await fetch(`/api/ddpm?province=${encodeURIComponent(p.name)}`);
      data = await r.json();
      if (!data.ok) throw new Error(data.error || 'โหลดข้อมูล ปภ. ไม่สำเร็จ');
      state.officialCache[p.name] = data;
    }

    loading.hidden = true;
    content.hidden = false;
    const sm = data.summary || {};
    $('#officialYears').textContent = fmt(sm.officialYearsWithRecords);
    $('#officialHouseholds').textContent = fmt(sm.households);
    $('#officialAgri').textContent = fmt(sm.agriRai);
    $('#officialDamage').textContent = fmt(sm.totalDamageM, 1);

    renderTags($('#officialDistrictTags'), sm.districts || [], true);
    renderOfficialYears(data.years || []);
    renderOfficialChart(data.years || []);
  } catch (e) {
    loading.hidden = true;
    content.hidden = true;
    error.hidden = false;
    error.textContent = `โหลดข้อมูลทางการไม่สำเร็จในรอบนี้: ${e.message || e}`;
  }
}

function renderOfficialYears(years) {
  const box = $('#officialYearCards');
  box.innerHTML = '';
  if (!years.length) {
    box.innerHTML = '<div class="empty-text">ยังไม่พบระเบียนของจังหวัดนี้ใน API ทางการที่เชื่อมได้ในรอบนี้</div>';
    return;
  }
  years.forEach(y => {
    const c = document.createElement('article');
    c.className = 'official-year-card';
    c.innerHTML = `
      <div><b>พ.ศ. ${y.year}</b><span>${y.recordCount || 0} ระเบียน</span></div>
      <div class="official-year-kpis">
        <span>ครัวเรือน <strong>${fmt(y.households)}</strong></span>
        <span>เกษตร <strong>${fmt(y.agriRai)} ไร่</strong></span>
        <span>เสียหาย <strong>${fmt(y.totalDamageM,1)} ลบ.</strong></span>
      </div>
      <p>${(y.districts || []).length ? `อำเภอ: ${y.districts.slice(0,8).join(', ')}${y.districts.length>8?'…':''}` : 'ยังไม่พบชื่ออำเภอในระเบียนที่ดึงได้'}</p>`;
    box.appendChild(c);
  });
}

function renderOfficialChart(years) {
  const canvas = $('#officialYearChart');
  if (!canvas || !window.Chart) return;
  if (state.charts.official) state.charts.official.destroy();
  const rows = years.slice().sort((a,b)=>a.year-b.year);
  state.charts.official = new Chart(canvas, {
    type:'bar',
    data:{ labels: rows.map(r=>r.year), datasets:[
      { label:'ความเสียหายรวม (ล้านบาท)', data:rows.map(r=>r.totalDamageM || 0), yAxisID:'y' },
      { label:'พื้นที่เกษตร (ไร่)', data:rows.map(r=>r.agriRai || 0), yAxisID:'y1', type:'line', tension:.25 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, plugins:{legend:{position:'bottom'}}, scales:{ y:{beginAtZero:true,position:'left'}, y1:{beginAtZero:true,position:'right',grid:{drawOnChartArea:false}} } }
  });
}

function selectProvince(name, opts = {}) {
  const p = state.history.find(x => x.name === name);
  if (!p) return;
  state.selected = p;
  state.selectedYear = (p.events || [])[0]?.year || null;
  localStorage.setItem('thaiflood:intel:selected', name);
  renderProvince();
  if (opts.openModal !== false) openProvinceModal();
  closeSearchModal();
}

function searchRows(query) {
  const term = normalize(query);
  if (!term) return state.ranked.slice(0, 12);
  return state.history.filter(p => {
    const bag = [p.name, p.region, ...(p.hotspots || []), ...(p.mechanisms || []), ...((p.events || []).map(e => e.areas || ''))].join(' ');
    return normalize(bag).includes(term);
  }).sort((a, b) => (b.recurrence || -1) - (a.recurrence || -1) || a.name.localeCompare(b.name, 'th')).slice(0, 18);
}

function renderSearchResults(query) {
  const box = $('#modalSearchResults');
  box.innerHTML = '';
  const rows = searchRows(query);
  if (!rows.length) {
    box.innerHTML = '<div class="empty-text">ไม่พบพื้นที่ที่ค้นหา</div>';
    return;
  }
  rows.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'search-item';
    b.innerHTML = `<div><b>${p.name}${p.hotspots?.length ? ' • ' + p.hotspots.join(', ') : ''}</b><span>ภาค${p.region}</span></div><span>${p.recurrence == null ? 'ยังไม่มีความถี่ในชุดอ้างอิง' : `${p.recurrence} ครั้ง / ${state.window.years} ปี`}</span>`;
    b.onclick = () => selectProvince(p.name, { openModal: true });
    box.appendChild(b);
  });
}

function openSearchModal() {
  $('#searchModal').hidden = false;
  document.body.style.overflow = 'hidden';
  const input = $('#searchModalInput');
  input.value = '';
  renderSearchResults('');
  setTimeout(() => input.focus(), 30);
}

function closeSearchModal() {
  $('#searchModal').hidden = true;
  if ($('#provinceModal').hidden) document.body.style.overflow = '';
}

function openProvinceModal() {
  $('#provinceModal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeProvinceModal() {
  $('#provinceModal').hidden = true;
  if ($('#searchModal').hidden) document.body.style.overflow = '';
}

$('#openSearchBtn').addEventListener('click', openSearchModal);
$('#closeSearchModal').addEventListener('click', closeSearchModal);
$('#closeProvinceModal').addEventListener('click', closeProvinceModal);
$$('.modal-backdrop').forEach(el => el.addEventListener('click', (e) => {
  if (e.currentTarget.dataset.close === 'search') closeSearchModal();
  if (e.currentTarget.dataset.close === 'province') closeProvinceModal();
}));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSearchModal();
    closeProvinceModal();
  }
});

$('#searchModalInput').addEventListener('input', (e) => renderSearchResults(e.target.value));

$('.mini-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab-btn');
  if (!b) return;
  $$('.tab-btn').forEach(x => x.classList.remove('active'));
  $$('.tab-panel').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  $('#tab' + b.dataset.tab[0].toUpperCase() + b.dataset.tab.slice(1)).classList.add('active');
});

$('#recurringOnlyBtn').onclick = () => {
  state.recurringOnly = !state.recurringOnly;
  $('#recurringOnlyBtn').classList.toggle('active', state.recurringOnly);
  $('#recurringOnlyBtn').textContent = state.recurringOnly ? '● เฉพาะท่วมซ้ำซาก' : '● ทุกจังหวัด';
  renderRanking();
};

$('#regionFilter').onchange = (e) => { state.filters.region = e.target.value; renderRanking(); renderMap(); };
$('#frequencyFilter').onchange = (e) => { state.filters.freq = e.target.value; renderRanking(); renderMap(); };
$('#mechanismFilter').onchange = (e) => { state.filters.mechanism = e.target.value; renderRanking(); renderMap(); };
$('#resetFilters').onclick = () => {
  state.filters = { region: 'all', freq: 'all', mechanism: 'all' };
  $('#regionFilter').value = 'all';
  $('#frequencyFilter').value = 'all';
  $('#mechanismFilter').value = 'all';
  renderRanking();
  renderMap();
};
$('#mapModeHistory').onclick = () => { state.mapMode='history'; $('#mapModeHistory').classList.add('active'); $('#mapModeRain').classList.remove('active'); renderMap(); };
$('#mapModeRain').onclick = () => { state.mapMode='rain'; $('#mapModeRain').classList.add('active'); $('#mapModeHistory').classList.remove('active'); renderMap(); };
$('#refreshBtn').onclick = () => loadAll(true);
$('#errorRetry').onclick = () => loadAll(true);

loadAll();
setInterval(() => loadAll(true), 30 * 60 * 1000);

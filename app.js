const state = {
  data: [],
  selected: null,
  loading: false,
  lastUpdated: null,
};

const $ = (s) => document.querySelector(s);
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: d });
const riskColor = { critical:'#d93f50', high:'#ef6c35', watch:'#e9a516', low:'#34a853' };
const riskAdvice = {
  critical:'ควรติดตามประกาศทางการอย่างใกล้ชิด หลีกเลี่ยงพื้นที่ลุ่มต่ำ เตรียมย้ายรถและสิ่งของขึ้นที่สูง และตรวจเส้นทางสำรอง',
  high:'เฝ้าระวังฝนต่อเนื่องและน้ำรอระบาย โดยเฉพาะพื้นที่ลุ่มต่ำ ริมคลอง และเส้นทางที่มีประวัติน้ำท่วมซ้ำ',
  watch:'มีสัญญาณฝนที่ควรติดตาม ควรเช็กพยากรณ์และระดับน้ำในพื้นที่เป็นระยะ โดยเฉพาะช่วงฝนหนัก',
  low:'ความเสี่ยงจากฝนอยู่ในระดับต่ำตามข้อมูลพยากรณ์ล่าสุด แต่สภาพจริงอาจต่างกันในระดับพื้นที่ย่อย'
};

function toThaiDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Bangkok'
  }).format(new Date(iso));
}

function dayName(dateStr, index) {
  if (!dateStr) return `วัน ${index+1}`;
  if (index === 0) return 'วันนี้';
  return new Intl.DateTimeFormat('th-TH', { weekday:'short', timeZone:'Asia/Bangkok' }).format(new Date(`${dateStr}T12:00:00+07:00`));
}

async function loadData(force = false) {
  if (state.loading) return;
  state.loading = true;
  $('#refreshBtn').style.opacity = '.45';
  $('#errorBanner').hidden = true;
  try {
    const r = await fetch(`/api/forecast${force ? `?t=${Date.now()}` : ''}`, { cache: force ? 'no-store' : 'default' });
    const payload = await r.json();
    if (!r.ok || !payload.ok) throw new Error(payload.error || 'ไม่สามารถโหลดข้อมูลได้');
    state.data = payload.provinces || [];
    state.lastUpdated = payload.updatedAt;
    $('#updatedAt').textContent = toThaiDate(payload.updatedAt);
    const saved = localStorage.getItem('thaiflood:selected');
    state.selected = state.data.find(p => p.name === saved) || state.data.find(p => p.name === 'กรุงเทพมหานคร') || state.data[0];
    renderAll();
  } catch (err) {
    $('#errorBanner').hidden = false;
    $('#errorText').textContent = err.message || 'กรุณาลองอีกครั้ง';
    $('#updatedAt').textContent = 'ยังไม่มีข้อมูลล่าสุด';
  } finally {
    state.loading = false;
    $('#refreshBtn').style.opacity = '1';
  }
}

function renderAll() {
  renderCounts();
  renderTopRisk();
  renderMap();
  renderSelected();
  renderSearch('');
  $('#todayChip').textContent = new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'}).format(new Date());
}

function renderCounts() {
  const c = { critical:0, high:0, watch:0, low:0 };
  state.data.forEach(p => c[p.key]++);
  $('#criticalCount').textContent = fmt(c.critical);
  $('#highCount').textContent = fmt(c.high);
  $('#watchCount').textContent = fmt(c.watch);
  const max = [...state.data].sort((a,b) => b.rain24-a.rain24)[0];
  $('#maxRain').textContent = max ? fmt(max.rain24,1) : '—';
}

function renderTopRisk() {
  const list = $('#topRiskList');
  list.innerHTML = '';
  state.data.slice(0, 8).forEach((p, i) => {
    const btn = document.createElement('button');
    btn.className = 'risk-row';
    btn.innerHTML = `<span class="rank">${String(i+1).padStart(2,'0')}</span><span><b>${p.name}</b><small>ฝนวันนี้ ${fmt(p.rain24,1)} มม. • 3 วัน ${fmt(p.rain3,1)} มม.</small></span><span class="risk-score ${p.key}">${p.score}</span>`;
    btn.addEventListener('click', () => selectProvince(p.name, true));
    list.appendChild(btn);
  });
}

function project(lat, lon) {
  // projection แบบง่ายเพื่อแสดงตำแหน่งสัมพัทธ์ของจังหวัดในประเทศไทย
  const minLon = 97.2, maxLon = 105.8, minLat = 5.4, maxLat = 20.7;
  const x = 80 + ((lon-minLon)/(maxLon-minLon))*460;
  const y = 650 - ((lat-minLat)/(maxLat-minLat))*585;
  return [x,y];
}

function renderMap() {
  const svg = $('#riskMap');
  svg.innerHTML = `
    <defs>
      <filter id="blur"><feGaussianBlur stdDeviation="16"/></filter>
    </defs>
    <path class="map-outline" d="M311 42 C338 75 360 106 355 144 C348 190 395 213 389 251 C381 300 414 319 438 353 C462 387 449 425 422 457 C391 494 405 532 435 574 C455 602 441 646 406 663 C377 676 350 646 336 618 C316 579 286 552 273 511 C259 466 242 437 219 401 C195 363 175 326 176 287 C178 245 206 216 230 187 C252 160 245 128 257 96 C269 66 286 47 311 42 Z"/>
  `;
  state.data.forEach(p => {
    const [x,y] = project(p.lat,p.lon);
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
    const r = p.score >= 75 ? 9 : p.score >= 55 ? 7.5 : p.score >= 30 ? 6 : 4.5;
    circle.setAttribute('cx',x); circle.setAttribute('cy',y); circle.setAttribute('r',r);
    circle.setAttribute('fill',riskColor[p.key]);
    circle.setAttribute('class',`province-dot ${state.selected?.name===p.name?'is-selected':''}`);
    circle.setAttribute('opacity',p.key==='low' ? '.55' : '.96');
    circle.setAttribute('tabindex','0');
    circle.setAttribute('aria-label',`${p.name} ดัชนีความเสี่ยง ${p.score}`);
    circle.addEventListener('click',()=>selectProvince(p.name,true));
    circle.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' ') selectProvince(p.name,true)});
    const title = document.createElementNS('http://www.w3.org/2000/svg','title');
    title.textContent = `${p.name} • ${p.label} • ${p.score}/100 • ฝน ${fmt(p.rain24,1)} มม.`;
    circle.appendChild(title);
    g.appendChild(circle);
    if (state.selected?.name===p.name) {
      const text = document.createElementNS('http://www.w3.org/2000/svg','text');
      text.setAttribute('x',x+13); text.setAttribute('y',y+4); text.setAttribute('class','dot-label');
      text.textContent = p.name;
      g.appendChild(text);
    }
    svg.appendChild(g);
  });
}

function renderSelected() {
  const p = state.selected;
  if (!p) return;
  $('#selectedName').textContent = p.name;
  $('#selectedRegion').textContent = `ภาค${p.region}`;
  const badge = $('#riskBadge');
  badge.className = `risk-badge ${p.key}`;
  badge.innerHTML = `<small>ดัชนีความเสี่ยงจากฝน</small><strong>${p.score}</strong><span>${p.label}</span>`;
  $('#metrics').innerHTML = `
    <div class="metric"><span>ฝนวันนี้</span><strong>${fmt(p.rain24,1)}</strong><small>มม.</small></div>
    <div class="metric"><span>ฝนสะสม 3 วัน</span><strong>${fmt(p.rain3,1)}</strong><small>มม.</small></div>
    <div class="metric"><span>โอกาสฝน</span><strong>${fmt(p.probability)}</strong><small>%</small></div>
    <div class="metric"><span>ฝนหนักสุด/ชม.</span><strong>${fmt(p.maxHourly,1)}</strong><small>มม.</small></div>`;
  $('#adviceBox').innerHTML = `<b>คำแนะนำ</b><span>${riskAdvice[p.key]}</span>`;
  renderChart(p);
  renderMap();
}

function renderChart(p) {
  const chart = $('#rainChart');
  chart.innerHTML = '';
  const values = p.sevenDayRain || [];
  const max = Math.max(15, ...values);
  values.slice(0,7).forEach((v,i) => {
    const col = document.createElement('div');
    col.className = `day-col ${i===0?'today':''}`;
    const h = Math.max(2, Math.round((v/max)*150));
    col.innerHTML = `<span class="bar-value">${fmt(v,1)}</span><div class="bar-track"><div class="bar" style="height:${h}px"></div></div><span class="day-label">${dayName(p.dates?.[i],i)}</span>`;
    chart.appendChild(col);
  });
}

function selectProvince(name, scroll = false) {
  const p = state.data.find(x => x.name === name);
  if (!p) return;
  state.selected = p;
  localStorage.setItem('thaiflood:selected',name);
  $('#provinceSearch').value = '';
  $('#searchResults').hidden = true;
  $('#clearSearch').style.display = 'none';
  renderSelected();
  if (scroll && window.innerWidth < 700) $('.province-card').scrollIntoView({behavior:'smooth',block:'start'});
}

function renderSearch(q) {
  const box = $('#searchResults');
  if (!q) { box.hidden = true; return; }
  const term = q.trim().toLowerCase();
  const results = state.data.filter(p => p.name.toLowerCase().includes(term) || p.region.toLowerCase().includes(term)).slice(0,12);
  box.innerHTML = '';
  if (!results.length) {
    box.innerHTML = `<div class="search-item"><span>ไม่พบจังหวัดที่ค้นหา</span></div>`;
  } else {
    results.forEach(p => {
      const b = document.createElement('button');
      b.className = 'search-item';
      b.innerHTML = `<b>${p.name}</b><span>ภาค${p.region} • ${p.label} ${p.score}</span>`;
      b.addEventListener('click',()=>selectProvince(p.name,true));
      box.appendChild(b);
    });
  }
  box.hidden = false;
}

function distanceKm(a,b) {
  const R=6371, rad=x=>x*Math.PI/180;
  const dLat=rad(b.lat-a.lat), dLon=rad(b.lon-a.lon);
  const x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}

$('#provinceSearch').addEventListener('input', e => {
  const q=e.target.value;
  $('#clearSearch').style.display=q?'block':'none';
  renderSearch(q);
});
$('#provinceSearch').addEventListener('focus', e => { if(e.target.value) renderSearch(e.target.value); });
$('#clearSearch').addEventListener('click',()=>{ $('#provinceSearch').value=''; $('#clearSearch').style.display='none'; $('#searchResults').hidden=true; $('#provinceSearch').focus(); });
document.addEventListener('click',(e)=>{ if(!e.target.closest('.search-box-wrap')) $('#searchResults').hidden=true; });
$('#refreshBtn').addEventListener('click',()=>loadData(true));
$('#errorRetry').addEventListener('click',()=>loadData(true));
$('#locateBtn').addEventListener('click',()=>{
  if (!navigator.geolocation) return alert('อุปกรณ์นี้ไม่รองรับตำแหน่งที่ตั้ง');
  $('#locateBtn').disabled = true;
  navigator.geolocation.getCurrentPosition(pos=>{
    const here={lat:pos.coords.latitude,lon:pos.coords.longitude};
    const nearest=[...state.data].sort((a,b)=>distanceKm(here,a)-distanceKm(here,b))[0];
    if(nearest) selectProvince(nearest.name,true);
    $('#locateBtn').disabled=false;
  },()=>{ alert('ไม่สามารถอ่านตำแหน่งได้ กรุณาอนุญาต Location ในเบราว์เซอร์'); $('#locateBtn').disabled=false; },{enableHighAccuracy:false,timeout:8000});
});

loadData();
setInterval(()=>loadData(true), 30 * 60 * 1000);

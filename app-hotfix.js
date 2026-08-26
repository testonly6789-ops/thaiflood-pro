const realFetch = window.fetch.bind(window);
const CACHE_PREFIX = 'thaiflood:ddpm-fast:';
const CACHE_TTL = 12 * 60 * 60 * 1000;
window.__tfOfficial = window.__tfOfficial || {};

function parseProvinceFromUrl(url) {
  try {
    const u = new URL(url, location.origin);
    if (u.pathname !== '/api/ddpm' && u.pathname !== '/api/ddpm-fast') return null;
    return u.searchParams.get('province');
  } catch { return null; }
}

function cacheRead(province) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + province);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry?.data || Date.now() - Number(entry.ts || 0) > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + province);
      return null;
    }
    return entry.data;
  } catch { return null; }
}

function cacheWrite(province, data) {
  try { localStorage.setItem(CACHE_PREFIX + province, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

window.fetch = async (input, init) => {
  const rawUrl = typeof input === 'string' ? input : input?.url;
  const province = rawUrl ? parseProvinceFromUrl(rawUrl) : null;
  if (!province) return realFetch(input, init);

  const cached = cacheRead(province);
  if (cached) {
    window.__tfOfficial[province] = cached;
    return new Response(JSON.stringify(cached), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-ThaiFlood-Cache': 'local' },
    });
  }

  const u = new URL(rawUrl, location.origin);
  u.pathname = '/api/ddpm-fast';
  const r = await realFetch(u.pathname + u.search, init);
  if (r.ok) {
    try {
      const data = await r.clone().json();
      if (data?.ok) {
        window.__tfOfficial[province] = data;
        cacheWrite(province, data);
      }
    } catch {}
  }
  return r;
};

const style = document.createElement('style');
style.textContent = `
#tabPattern .metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
#tabPattern .metric-grid>div{min-height:94px!important;padding:14px 16px!important;border-bottom:1px solid #e3ebf4!important}
#tabPattern .metric-grid>div:nth-child(2n){border-right:0!important}
#tabPattern .metric-grid strong{font-size:30px!important}
#tabPattern .metric-grid--secondary{display:none!important}
.event-card{padding:14px!important}
.event-head{display:flex!important;align-items:flex-start!important;gap:10px!important;margin-bottom:12px!important}
.event-year{width:auto!important;min-width:96px!important;max-width:max-content!important;padding:8px 14px!important;border-radius:999px!important;font-size:15px!important;line-height:1.2!important;white-space:nowrap!important}
.event-title{min-width:0!important}
.event-title b{font-size:17px!important;line-height:1.45!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important}
.event-title small{font-size:12px!important;margin-top:3px!important}
.event-kpis{gap:8px!important}
.event-kpis article{padding:12px!important;min-height:0!important}
.event-kpis strong{font-size:22px!important}
.event-kpis p{margin-top:5px!important;font-size:11px!important;line-height:1.45!important}
.event-note-grid{grid-template-columns:1fr!important;gap:8px!important}
.event-note{padding:12px!important}
.event-note h5{margin-bottom:4px!important}
.event-note p{font-size:12px!important;line-height:1.55!important}
#hotspotTags .tag:nth-child(n+7){display:none!important}
@media(max-width:720px){
  .event-head{flex-direction:row!important}
  .event-year{font-size:14px!important;min-width:88px!important}
  .event-kpis{grid-template-columns:1fr 1fr!important}
  .event-title b{font-size:16px!important}
}
`;
document.head.appendChild(style);

await import('/app-core.js?v=20260826-fast2');

const fmt = (n, d = 0) => n == null ? 'ไม่มีข้อมูล' : Number(n).toLocaleString('th-TH', { maximumFractionDigits:d });

function getSelectedData() {
  const name = document.querySelector('#selectedName')?.textContent?.trim();
  if (!name || name === '—') return null;
  return window.__tfOfficial[name] || cacheRead(name);
}

function compactMetrics(data) {
  const primary = document.querySelector('#tabPattern .metric-grid:not(.metric-grid--secondary)');
  const secondary = document.querySelector('#tabPattern .metric-grid--secondary');
  if (!primary || !secondary || !data) return;
  const order = ['metricRecurrence','metricEventCount','metricHouseholds','metricAgri','metricDamage','metricAid','metricCropAid','metricWater'];
  const required = new Set(['metricRecurrence','metricEventCount']);
  order.forEach(id => {
    const el = document.getElementById(id);
    const card = el?.parentElement;
    if (!el || !card) return;
    const missing = el.textContent.trim() === 'ไม่มีข้อมูล' || el.textContent.trim() === '—';
    card.hidden = missing && !required.has(id);
    primary.appendChild(card);
  });
  secondary.hidden = true;
}

function compactDistrictTags(data) {
  const box = document.querySelector('#hotspotTags');
  if (!box || !data) return;
  const names = data.summary?.districts || [];
  const count = Number(data.summary?.districtCount || names.length || 0);
  box.innerHTML = '';
  names.slice(0,5).forEach(name => {
    const s = document.createElement('span');
    s.className = 'tag emphasis';
    s.textContent = name;
    box.appendChild(s);
  });
  if (count > 5) {
    const more = document.createElement('span');
    more.className = 'tag';
    more.textContent = `+อีก ${count - 5} อำเภอ`;
    box.appendChild(more);
  }
}

function compactEventCards(data) {
  if (!data) return;
  document.querySelectorAll('.event-card').forEach(card => {
    const year = Number((card.id || '').replace('event-',''));
    const y = (data.years || []).find(x => Number(x.year) === year);
    if (!y) return;
    const districtCount = Number(y.districtCount || y.districts?.length || 0);
    const shown = (y.districts || []).slice(0,3);
    const areaText = shown.length
      ? `${shown.join(' • ')}${districtCount > shown.length ? ` • +อีก ${districtCount - shown.length} อำเภอ` : ''}`
      : 'ไม่พบชื่ออำเภอในชุดข้อมูลปีนี้';
    const title = card.querySelector('.event-title b');
    const sub = card.querySelector('.event-title small');
    if (title) title.textContent = areaText;
    if (sub) sub.textContent = `${fmt(y.recordCount)} ระเบียน${districtCount ? ` • ${fmt(districtCount)} อำเภอ` : ''}`;

    const kpis = card.querySelectorAll('.event-kpis article');
    if (kpis[0]) kpis[0].innerHTML = `<span>ผลรวมครัวเรือนตามระเบียน ปภ.</span><strong>${fmt(y.households)}</strong><p>${fmt(y.recordCount)} ระเบียน${districtCount ? ` • ${fmt(districtCount)} อำเภอ` : ''}</p>`;
    if (kpis[1]) kpis[1].innerHTML = `<span>พื้นที่เกษตรที่ได้รับผลกระทบ</span><strong>${y.agriRai == null ? 'ไม่มีข้อมูล' : `${fmt(y.agriRai)} ไร่`}</strong><p>${y.totalDamageM == null ? 'ความเสียหาย: ไม่มีข้อมูลในชุดนี้' : `ความเสียหายที่มีข้อมูล ${fmt(y.totalDamageM,1)} ล้านบาท`}</p>`;

    const grids = card.querySelectorAll('.event-note-grid');
    if (grids[0]) {
      const notes = grids[0].querySelectorAll('.event-note');
      const causes = (y.causes || []).slice(0,3);
      if (notes[0]) notes[0].innerHTML = `<h5>สาเหตุหลัก</h5><p>${causes.length ? causes.join(' • ') : 'ไม่มีข้อมูลสาเหตุในปีนี้'}</p>`;
      if (notes[1]) notes[1].innerHTML = `<h5>ขอบเขตข้อมูล</h5><p>${districtCount ? `พบข้อมูลใน ${fmt(districtCount)} อำเภอ` : 'ไม่พบชื่ออำเภอ'} • ${fmt(y.recordCount)} ระเบียน</p>`;
    }
    if (grids[1]) grids[1].hidden = true;
  });
}

function compactInsight(data) {
  const el = document.querySelector('#patternInsight');
  if (!el || !data) return;
  const years = data.years || [];
  const count = Number(data.summary?.districtCount || data.summary?.districts?.length || 0);
  el.textContent = years.length
    ? `พบระเบียนอุทกภัยทางการ ${years.length} ปี ครอบคลุมสูงสุด ${fmt(count)} อำเภอ แสดงเฉพาะข้อมูลที่มีในต้นทาง และซ่อนช่องที่ไม่มีข้อมูลเพื่อให้อ่านง่ายขึ้น`
    : 'ไม่พบระเบียนอุทกภัยของจังหวัดนี้ในชุดข้อมูล ปภ. ที่เชื่อมต่อ';
}

function compactOfficialCards(data) {
  if (!data) return;
  document.querySelectorAll('.official-year-card').forEach(card => {
    const text = card.querySelector('b')?.textContent || '';
    const year = Number(text.replace(/\D/g,''));
    const y = (data.years || []).find(x => Number(x.year) === year);
    if (!y) return;
    const p = card.querySelector('p');
    const count = Number(y.districtCount || y.districts?.length || 0);
    const names = (y.districts || []).slice(0,3);
    if (p) p.textContent = names.length ? `พื้นที่หลัก: ${names.join(' • ')}${count > names.length ? ` • +อีก ${count - names.length} อำเภอ` : ''}` : 'ไม่พบชื่ออำเภอในปีนี้';
  });
}

let scheduled = false;
function compactNow() {
  scheduled = false;
  const data = getSelectedData();
  if (!data) return;
  compactMetrics(data);
  compactDistrictTags(data);
  compactEventCards(data);
  compactOfficialCards(data);
  compactInsight(data);
}
function scheduleCompact() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(compactNow);
}

const modal = document.querySelector('#provinceModal');
if (modal) new MutationObserver(scheduleCompact).observe(modal, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['hidden'] });
setTimeout(scheduleCompact, 300);

async function prefetchTop() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn?.saveData || /(^|-)2g/.test(conn?.effectiveType || '')) return;
  const names = [...document.querySelectorAll('#hotspotChips .hotspot-chip span')].map(x=>x.textContent.trim()).filter(Boolean).slice(0,6);
  for (let i=0; i<names.length; i+=2) {
    await Promise.all(names.slice(i,i+2).map(name => window.fetch(`/api/ddpm?province=${encodeURIComponent(name)}`).then(r=>r.json()).catch(()=>null)));
  }
}
setTimeout(prefetchTop, 1800);

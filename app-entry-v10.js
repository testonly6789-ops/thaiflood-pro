// Unified 14-year visible layer. Older entry files provide the existing UI and
// detailed DDPM impact cards; this file is the sole owner of visible historical
// recurrence semantics on the overview and Province Deep Dive.
const guard = document.createElement('style');
guard.id = 'tfHistorical14yGuard';
guard.textContent = `
#headlineStats article:nth-child(-n+3),
.quick-hotspots-card,.analytics-card,.map-card,.ranking-card {visibility:hidden!important;}
`;
document.head.appendChild(guard);

await import('/app-entry-v6.js?v=20260827-historical14y-base');

const baseFetch = window.fetch.bind(window);
const PERIOD = {start:2554,end:2567,years:14};
const PERSISTENT_MIN = 7;
const HIGH_MIN = 10;
let national = null;
let provinceMap = new Map();
let overviewReady = false;

const fmt = n => Number(n || 0).toLocaleString('th-TH');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function enrichProvince(p) {
  const ranking = Array.isArray(p?.ranking) ? p.ranking : [];
  return {
    ...p,
    persistentDistrictCount: ranking.filter(d => Number(d.yearCount || 0) >= PERSISTENT_MIN).length,
    highDistrictCount: ranking.filter(d => Number(d.yearCount || 0) >= HIGH_MIN).length,
  };
}

function rebuildNational(payload) {
  const provinces = (payload?.provinces || []).map(enrichProvince);
  provinceMap = new Map(provinces.map(p => [p.province, p]));
  const allDistricts = provinces.flatMap(p => (p.ranking || []).map(d => ({province:p.province,...d})));
  const persistentTotal = allDistricts.filter(d => Number(d.yearCount || 0) >= PERSISTENT_MIN).length;
  const highTotal = allDistricts.filter(d => Number(d.yearCount || 0) >= HIGH_MIN).length;
  const topPersistentProvince = provinces.slice().sort((a,b) =>
    b.persistentDistrictCount-a.persistentDistrictCount || b.highDistrictCount-a.highDistrictCount ||
    b.maxYears-a.maxYears || a.province.localeCompare(b.province,'th'))[0] || null;
  national = {...payload,provinces,persistentTotal,highTotal,topPersistentProvince};
  window.__tfNationalSpatial = national;
  window.__tfHistorical14y = national;
}

async function loadNational() {
  const r = await baseFetch('/api/spatial-index?historical14y=1', {cache:'default'});
  const data = await r.json();
  if (!r.ok || !data?.ok) throw new Error(data?.error || 'ฐานข้อมูลย้อนหลัง 14 ปียังไม่ผ่านการตรวจ');
  if (Number(data.provinceCount) !== 77 || Number(data.coverage?.years) !== 14 || Number(data.coverage?.startBE) !== 2554 || Number(data.coverage?.endBE) !== 2567) {
    throw new Error('ขอบเขตฐานข้อมูลย้อนหลัง 14 ปีไม่ครบตามเกณฑ์');
  }
  if (Number(data.totalDistrictsWithAnyHistory) > 928) throw new Error('ตรวจพบอำเภอ/เขตซ้ำในฐานย้อนหลัง');
  rebuildNational(data);
  return national;
}

function rewriteHistory(data) {
  if (!data?.ok || !provinceMap.size) return data;
  const provinces = (data.provinces || []).map(p => {
    const h = provinceMap.get(p.name);
    if (!h) return {...p,recurrence:null,historical14y:null};
    return {
      ...p,
      // app-core uses recurrence for chart/ranking/map. Use the persistent-area
      // burden (>= half of the 14-year period), not raw record counts.
      recurrence:Number(h.persistentDistrictCount || 0),
      hotspots:(h.ranking || []).filter(d=>Number(d.yearCount||0)>=PERSISTENT_MIN).slice(0,4).map(d=>d.district),
      historical14y:h,
      spatialRecurrence:{
        recurringDistrictCount:Number(h.recurringDistrictCount || 0),
        persistentDistrictCount:Number(h.persistentDistrictCount || 0),
        highDistrictCount:Number(h.highDistrictCount || 0),
        maxYears:Number(h.maxYears || 0),
        checkedYears:14,
        checkedYearList:Array.from({length:14},(_,i)=>2554+i),
        topDistricts:h.topDistricts || [],
        ranking:h.ranking || [],
      },
    };
  });
  const ranked = provinces.filter(p=>Number(p.recurrence||0)>0)
    .sort((a,b)=>Number(b.recurrence||0)-Number(a.recurrence||0)
      || Number(b.historical14y?.highDistrictCount||0)-Number(a.historical14y?.highDistrictCount||0)
      || Number(b.historical14y?.maxYears||0)-Number(a.historical14y?.maxYears||0)
      || a.name.localeCompare(b.name,'th'));
  return {...data,provinces,ranked,window:{start:2554,end:2567,years:14}};
}

// From this point onward every refresh of the legacy overview receives the
// same 14-year semantics.
window.fetch = async (input, init) => {
  try {
    const raw = typeof input === 'string' ? input : input?.url;
    if (raw && new URL(raw, location.origin).pathname === '/api/history' && provinceMap.size) {
      const r = await baseFetch(input, init);
      if (!r.ok) return r;
      const data = await r.clone().json();
      return new Response(JSON.stringify(rewriteHistory(data)), {status:r.status,headers:{'Content-Type':'application/json; charset=utf-8'}});
    }
  } catch {}
  return baseFetch(input, init);
};

function patchCopy() {
  const eyebrow = document.querySelector('.hero .eyebrow');
  if (eyebrow) eyebrow.textContent = 'FLOOD PATTERN INTELLIGENCE • ประวัติ 14 ปี พ.ศ. 2554–2567';
  const heroP = document.querySelector('.hero-copy-wrap > p:last-child');
  if (heroP) heroP.innerHTML = 'ระบบวิเคราะห์ว่า <b>“พื้นที่เดิมท่วมซ้ำบ่อยแค่ไหน และจังหวัดใดมีภาระพื้นที่ท่วมซ้ำต่อเนื่องสูง”</b> จากหลักฐานย้อนหลัง 14 ปี โดยแยกแหล่งข้อมูล GISTDA และ ปภ. อย่างชัดเจน';

  const mapHead = document.querySelector('.map-card .section-head > div:first-child');
  if (mapHead) {
    const h2=mapHead.querySelector('h2'), p=mapHead.querySelector('p:not(.kicker)');
    if (h2) h2.textContent='แผนที่พื้นที่ท่วมซ้ำต่อเนื่องย้อนหลัง 14 ปี';
    if (p) p.textContent='1 จุด = 1 จังหวัด • ขนาดจุด = จำนวนอำเภอ/เขตที่พบซ้ำ ≥7/14 ปี • สี = ความถี่สูงสุดของพื้นที่เดิม';
  }
  const rankHead = document.querySelector('.ranking-card .section-head > div:first-child');
  if (rankHead) {
    const h2=rankHead.querySelector('h2'), p=rankHead.querySelector('p:not(.kicker)');
    if (h2) h2.textContent='จังหวัดที่มีพื้นที่ท่วมซ้ำต่อเนื่องมากที่สุด';
    if (p) p.textContent='เรียงจากจำนวนอำเภอ/เขตที่พบหลักฐานอุทกภัยอย่างน้อย 7 จาก 14 ปี';
  }
  const analyticsP=document.querySelector('.analytics-card .section-head p:not(.kicker)');
  if (analyticsP) analyticsP.textContent='จำนวนอำเภอ/เขตที่พบหลักฐานอุทกภัยอย่างน้อย 7 จาก 14 ปี';
  const filter=document.querySelector('#frequencyFilter');
  const label=filter?.closest('label');
  if (label?.firstChild?.nodeType===Node.TEXT_NODE) label.firstChild.textContent='จำนวนพื้นที่ท่วมซ้ำต่อเนื่อง';
  filter?.querySelectorAll('option').forEach(o=>{o.textContent=o.value==='all'?'ทั้งหมด':`${o.value} อำเภอ/เขตขึ้นไป`;});
}

function patchHeadline() {
  if (!national) return;
  const cards=[...document.querySelectorAll('#headlineStats article')];
  const set=(card,label,value,note)=>{
    if (!card) return;
    const s=card.querySelector('span'),b=card.querySelector('strong'),sm=card.querySelector('small');
    if(s)s.textContent=label;if(b)b.textContent=value;if(sm)sm.textContent=note;
  };
  set(cards[0],'อำเภอ/เขตที่พบหลักฐานท่วมซ้ำ',fmt(national.totalRecurringDistricts),'ซ้ำอย่างน้อย 2 ปี • จากพื้นที่ที่มีประวัติ 927 แห่ง');
  set(cards[1],'ท่วมซ้ำต่อเนื่องสูง',fmt(national.highTotal),`อำเภอ/เขต • พบซ้ำ ≥${HIGH_MIN}/14 ปี`);
  const top=national.topPersistentProvince;
  if(top) set(cards[2],'จังหวัดที่มีพื้นที่ท่วมซ้ำต่อเนื่องมากสุด',top.province,`${fmt(top.persistentDistrictCount)} อำเภอ/เขต • พบซ้ำ ≥${PERSISTENT_MIN}/14 ปี`);
}

function patchRankingAndChips() {
  document.querySelectorAll('.hotspot-chip').forEach(btn=>{
    const name=btn.querySelector('span')?.textContent?.trim(); const h=provinceMap.get(name); const sm=btn.querySelector('small');
    if(h&&sm)sm.textContent=`${fmt(h.persistentDistrictCount)} พื้นที่ซ้ำ ≥${PERSISTENT_MIN}/14 ปี`;
  });
  document.querySelectorAll('#rankingList .rank-row').forEach(row=>{
    const name=row.querySelector('b')?.textContent?.trim(); const h=provinceMap.get(name); if(!h)return;
    const pill=row.querySelector('.freq-pill'); if(pill)pill.textContent=`${fmt(h.persistentDistrictCount)} พื้นที่`;
    const sm=row.querySelector('span:nth-child(2) small');
    if(sm)sm.textContent=`ซ้ำสูง ≥${HIGH_MIN}/14 ปี ${fmt(h.highDistrictCount)} พื้นที่ • สูงสุด ${fmt(h.maxYears)}/14 ปี`;
  });
}

function patchChart() {
  const chart=window.Chart?.getChart?.('recurrenceChart'); if(!chart)return;
  chart.data.datasets[0].label=`อำเภอ/เขตซ้ำ ≥${PERSISTENT_MIN}/14 ปี`;
  const fn=ctx=>`${ctx.raw} อำเภอ/เขต • ซ้ำ ≥${PERSISTENT_MIN}/14 ปี`; fn.__tf14=true;
  chart.options.plugins.tooltip.callbacks.label=fn; chart.update('none');
}

function markerColor(maxYears) {
  const n=Number(maxYears||0); if(n>=12)return '#c93648'; if(n>=10)return '#e96c35'; if(n>=7)return '#e5a721'; return '#7f8d9a';
}
function markerRadius(count) { return Math.max(6,Math.min(22,6+Math.sqrt(Math.max(0,Number(count||0)))*3)); }
function findProvinceByLatLng(latlng) {
  const lat=Number(Array.isArray(latlng)?latlng[0]:latlng?.lat); const lon=Number(Array.isArray(latlng)?latlng[1]:(latlng?.lng??latlng?.lon));
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
  return (national?.provinces||[]).find(p=>Math.abs(Number(p.lat)-lat)<0.00001&&Math.abs(Number(p.lon)-lon)<0.00001)||null;
}
window.__tfMapRadiusQC={};
const nativeCircle=window.L?.circleMarker?.bind(window.L);
if(nativeCircle){
  window.L.circleMarker=(latlng,options={})=>{
    const next={...options}; const h=findProvinceByLatLng(latlng);
    if(h&&document.querySelector('#mapModeHistory')?.classList.contains('active')){
      next.radius=markerRadius(h.persistentDistrictCount); next.fillColor=markerColor(h.maxYears);
      window.__tfMapRadiusQC[h.province]={count:h.persistentDistrictCount,maxYears:h.maxYears,radius:next.radius};
    }
    return nativeCircle(latlng,next);
  };
}

function patchMapPopups() {
  document.querySelectorAll('.map-popup').forEach(pop=>{
    const name=pop.querySelector('h4')?.textContent?.trim(); const h=provinceMap.get(name); const p=pop.querySelector('p');
    if(h&&p&&!p.textContent.includes('ดัชนีฝน'))p.textContent=`ซ้ำ ≥${PERSISTENT_MIN}/14 ปี ${fmt(h.persistentDistrictCount)} อำเภอ/เขต • ซ้ำสูง ≥${HIGH_MIN}/14 ปี ${fmt(h.highDistrictCount)} • สูงสุด ${fmt(h.maxYears)}/14 ปี`;
  });
}

function selectedName(){const n=document.querySelector('#selectedName')?.textContent?.trim();return n&&n!=='—'?n:null;}
function selectedHistorical(){return provinceMap.get(selectedName())||null;}

function render14YearMatrix(h){
  const box=document.querySelector('#spatialYearMatrix'); if(!box||!h)return;
  const windowText=document.querySelector('#yearWindowText'); if(windowText)windowText.textContent='2554 → 2567';
  box.innerHTML='';
  for(let be=2554;be<=2567;be++){
    const ce=be-543, count=Number(h.yearDistrictCounts?.[ce]||0), source=be<=2559?'GISTDA':'ปภ.';
    const cell=document.createElement('button');cell.type='button';cell.className=`year-cell ${count>0?'has-event':''}`;
    cell.innerHTML=`<b>${String(be).slice(-2)}</b><span>${count>0?`${count} พื้นที่`:'ไม่พบ'}</span>`;
    cell.title=`พ.ศ. ${be} • ${source} • ${count>0?`พบหลักฐานใน ${count} อำเภอ/เขต`:'ไม่พบหลักฐานในชุดข้อมูล'}`;
    cell.addEventListener('click',()=>{box.querySelectorAll('.year-cell').forEach(x=>x.classList.toggle('active',x===cell));document.getElementById(`event-${be}`)?.scrollIntoView({behavior:'smooth',block:'nearest'});});
    box.appendChild(cell);
  }
}

function patchDeepDive(){
  const h=selectedHistorical(); if(!h)return;
  const top=(h.ranking||[]).filter(d=>Number(d.yearCount||0)>=2).slice(0,6); const max=Number(h.maxYears||0);
  const names=top.slice(0,3).map(d=>d.district); const more=top.length>3?` +อีก ${top.length-3}`:'';
  const badge=document.querySelector('#spatialRecurrenceBadge');
  if(badge)badge.innerHTML=`<small>พื้นที่เดิมท่วมซ้ำสูงสุด • 14 ปี</small><strong style="font-size:22px;line-height:1.15">${max}/14 ปี</strong><span>${names.join(' • ')}${more}</span>`;
  const metric=document.querySelector('#metricSpatialRecurrence');
  if(metric){metric.textContent=`${max}/14 ปี`;const c=metric.parentElement;const l=c?.querySelector('span'),n=c?.querySelector('small');if(l)l.textContent='อำเภอ/เขตเดิมที่พบอุทกภัยซ้ำสูงสุด';if(n)n.textContent=`${names.join(' • ')}${more}`;}
  const official=document.querySelector('#officialSpatialRecurrence');
  if(official){official.textContent=`${max}/14 ปี`;const c=official.parentElement,l=c?.querySelector('span'),n=c?.querySelector('small');if(l)l.textContent='ความถี่พื้นที่เดิมสูงสุด';if(n)n.textContent='ย้อนหลัง พ.ศ. 2554–2567 • 14 ปี';}
  const tags=document.querySelector('#spatialHotspotTags');if(tags)tags.innerHTML=top.map(d=>`<span class="tag emphasis">${d.district} • ${d.yearCount}/14 ปี</span>`).join('');
  const insight=document.querySelector('#spatialPatternInsight');if(insight)insight.textContent=`${h.province}: พบหลักฐานท่วมซ้ำ ≥2 ปี ${fmt(h.recurringDistrictCount)} อำเภอ/เขต • ซ้ำต่อเนื่อง ≥${PERSISTENT_MIN}/14 ปี ${fmt(h.persistentDistrictCount)} • ซ้ำสูง ≥${HIGH_MIN}/14 ปี ${fmt(h.highDistrictCount)} • พื้นที่เดิมสูงสุด ${max}/14 ปี`;
  const cl=document.querySelector('#spatialConfidenceLabel'),ct=document.querySelector('#spatialConfidenceText');
  if(cl)cl.textContent='ขอบเขตฐานข้อมูลย้อนหลัง 14 ปี';
  if(ct)ct.textContent='พ.ศ. 2554–2559 ใช้หลักฐานพื้นที่น้ำท่วมจาก GISTDA; พ.ศ. 2560–2567 ใช้จำนวนการเกิดอุทกภัยรายหมู่บ้านจาก ปภ. แหล่งข้อมูลต่างวิธีจึงแสดงที่มารายช่วง และไม่ตีความข้อมูลขาดว่า “ไม่ท่วม”';
  render14YearMatrix(h);
}

function patchAll(){patchCopy();patchHeadline();patchRankingAndChips();patchChart();patchMapPopups();patchDeepDive();}

function showFailure(message){
  const b=document.querySelector('#errorBanner'),t=document.querySelector('#errorText');if(b)b.hidden=false;if(t)t.textContent=message||'ฐานข้อมูลย้อนหลัง 14 ปียังไม่ผ่านการตรวจ จึงไม่แสดงตัวเลขที่อาจผิด';
}

try{
  await loadNational();
  patchDeepDive();
  // Force the existing chart/ranking/map to rebuild using the intercepted 14-year history.
  document.querySelector('#refreshBtn')?.click();
  await sleep(500); patchAll(); await sleep(800); patchAll();
  const cards=[...document.querySelectorAll('#headlineStats article')];
  const ok=Number(national.totalDistrictsWithAnyHistory)<=928
    && Number(national.provinceCount)===77
    && Number(national.totalRecurringDistricts)===881
    && Number(national.persistentTotal)===637
    && Number(national.highTotal)===247
    && cards[0]?.querySelector('strong')?.textContent?.replace(/,/g,'').trim()==='881'
    && cards[1]?.querySelector('strong')?.textContent?.replace(/,/g,'').trim()==='247';
  if(!ok)throw new Error('QC ตัวเลข 14 ปีบนหน้าจอไม่ผ่าน');
  overviewReady=true;guard.remove();
  window.dispatchEvent(new CustomEvent('tf:historical14y-ready',{detail:{ok:true}}));
}catch(error){console.error('Historical 14-year UI failed',error);showFailure(error.message);}

// Narrow observer: only rerender the province recurrence block after province switches.
const selected=document.querySelector('#selectedName');
if(selected){new MutationObserver(()=>requestAnimationFrame(()=>{if(overviewReady)patchDeepDive();})).observe(selected,{subtree:true,childList:true,characterData:true});}
setTimeout(()=>{if(overviewReady)patchAll();},1800);

// Final Province Deep Dive owner for the 14-year release.
// It runs after the unified overview and always writes after legacy DDPM observers.
const deepGuard=document.createElement('style');
deepGuard.id='tfHistoricalDeepGuard';
deepGuard.textContent=`
#spatialRecurrenceBadge,#metricSpatialRecurrence,#spatialYearMatrix,
#spatialHotspotTags,#spatialPatternInsight {visibility:hidden!important;}
.tf-hide-official-coverage{display:none!important;}
`;
document.head.appendChild(deepGuard);

await import('/app-entry-v10.js?v=20260827-historical14y-final2');

const PERSISTENT_MIN=7,HIGH_MIN=10;
const fmt=n=>Number(n||0).toLocaleString('th-TH');
function selectedName(){const n=document.querySelector('#selectedName')?.textContent?.trim();return n&&n!=='—'?n:null;}
function selectedHistory(){return (window.__tfHistorical14y?.provinces||[]).find(p=>p.province===selectedName())||null;}
function derived(h){const r=h?.ranking||[];return{persistent:r.filter(d=>Number(d.yearCount||0)>=PERSISTENT_MIN).length,high:r.filter(d=>Number(d.yearCount||0)>=HIGH_MIN).length};}

function renderMatrix(h){
  const box=document.querySelector('#spatialYearMatrix');if(!box||!h)return;
  const wt=document.querySelector('#yearWindowText');if(wt)wt.textContent='2554 → 2567';
  box.innerHTML='';
  for(let be=2554;be<=2567;be++){
    const ce=be-543,count=Number(h.yearDistrictCounts?.[ce]||0),source=be<=2559?'GISTDA':'ปภ.';
    const cell=document.createElement('button');cell.type='button';cell.className=`year-cell ${count>0?'has-event':''}`;
    cell.innerHTML=`<b>${String(be).slice(-2)}</b><span>${count>0?`${count} พื้นที่`:'ไม่พบ'}</span>`;
    cell.title=`พ.ศ. ${be} • ${source} • ${count>0?`พบหลักฐาน ${count} อำเภอ/เขต`:'ไม่พบหลักฐานในแหล่งข้อมูลนี้'}`;
    cell.addEventListener('click',()=>{box.querySelectorAll('.year-cell').forEach(x=>x.classList.toggle('active',x===cell));document.getElementById(`event-${be}`)?.scrollIntoView({behavior:'smooth',block:'nearest'});});
    box.appendChild(cell);
  }
}

function renderDeep(){
  const h=selectedHistory();if(!h)return false;
  const d=derived(h),ranking=(h.ranking||[]).filter(x=>Number(x.yearCount||0)>=2),top=ranking.slice(0,6),top3=top.slice(0,3);
  const max=Number(h.maxYears||0),names=top3.map(x=>x.district),more=top.length>3?` +อีก ${top.length-3}`:'';
  const badge=document.querySelector('#spatialRecurrenceBadge');
  if(badge){badge.innerHTML=`<small>พื้นที่เดิมท่วมซ้ำสูงสุด • 14 ปี</small><strong style="font-size:22px;line-height:1.15">${max}/14 ปี</strong><span>${names.join(' • ')}${more}</span>`;badge.title='ความถี่ของอำเภอ/เขตเดิมจากหลักฐานย้อนหลัง พ.ศ. 2554–2567';}
  const metric=document.querySelector('#metricSpatialRecurrence');
  if(metric){metric.textContent=`${max}/14 ปี`;const c=metric.parentElement,l=c?.querySelector('span'),n=c?.querySelector('small');if(c)c.style.gridColumn='1 / -1';if(l)l.textContent='อำเภอ/เขตเดิมที่พบอุทกภัยซ้ำสูงสุด';if(n)n.textContent=`${names.join(' • ')}${more}`;}

  // Remove the legacy 7-year DDPM coverage card from the Overview tab.
  // It is source-coverage metadata, not a province flood KPI, and displaying it
  // beside the 14-year recurrence metric is misleading.
  const official=document.querySelector('#officialSpatialRecurrence');
  if(official){const c=official.parentElement;if(c)c.classList.add('tf-hide-official-coverage');}

  const tags=document.querySelector('#spatialHotspotTags');
  if(tags)tags.innerHTML=top.length?top.map(x=>`<span class="tag emphasis">${x.district} • ${x.yearCount}/14 ปี</span>`).join(''):'<span class="empty-text">ไม่พบพื้นที่เดิมซ้ำ ≥2 ปี</span>';
  const insight=document.querySelector('#spatialPatternInsight');
  if(insight)insight.textContent=`${h.province}: พบหลักฐานท่วมซ้ำ ≥2 ปี ${fmt(h.recurringDistrictCount)} อำเภอ/เขต • ซ้ำต่อเนื่อง ≥${PERSISTENT_MIN}/14 ปี ${fmt(d.persistent)} • ซ้ำต่อเนื่องสูง ≥${HIGH_MIN}/14 ปี ${fmt(d.high)} • สูงสุด ${max}/14 ปี`;
  const cl=document.querySelector('#spatialConfidenceLabel'),ct=document.querySelector('#spatialConfidenceText');
  if(cl)cl.textContent='ฐานประวัติ 14 ปี • แยกแหล่งข้อมูลตามช่วง';
  if(ct)ct.textContent='พ.ศ. 2554–2559: GISTDA (หลักฐานพื้นที่น้ำท่วมจากดาวเทียม) • พ.ศ. 2560–2567: ปภ. (จำนวนการเกิดอุทกภัยรายหมู่บ้าน) • ข้อมูลขาดไม่ถูกนับเป็น “ไม่ท่วม”';
  renderMatrix(h);
  return true;
}

function queueDeep(){requestAnimationFrame(()=>{if(renderDeep())deepGuard.remove();});}
const targets=['#selectedName','#eventDetails','#officialContent'].map(s=>document.querySelector(s)).filter(Boolean);
const obs=new MutationObserver(queueDeep);targets.forEach(t=>obs.observe(t,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class']}));
document.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>setTimeout(queueDeep,0)));
queueDeep();setTimeout(queueDeep,500);setTimeout(queueDeep,2000);setTimeout(queueDeep,5000);

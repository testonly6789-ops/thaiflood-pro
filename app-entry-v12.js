// Mobile-first loading polish for the 14-year dashboard.
// Data validity and UI polish are intentionally separate: once the verified
// 14-year payload is present, the page must never remain trapped behind a
// visual-QC loading gate.
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
  try{
    const raw=typeof input==='string'?input:input?.url;
    const u=new URL(raw,location.origin);
    if(u.pathname==='/api/spatial-index'&&u.searchParams.get('historical14y')==='1'){
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),20000);
      try{
        return await nativeFetch(input,{...(init||{}),signal:controller.signal,cache:'no-store'});
      }finally{clearTimeout(timer);}
    }
  }catch(error){
    if(error?.name==='AbortError')throw new Error('โหลดฐานประวัติ 14 ปีเกิน 20 วินาที');
    throw error;
  }
  return nativeFetch(input,init);
};

const style=document.createElement('style');
style.id='tf14MobilePolish';
style.textContent=`
html,body{max-width:100%;overflow-x:hidden}
html.tf14-loading #headlineStats,
html.tf14-loading .quick-hotspots-card,
html.tf14-loading .analytics-grid,
html.tf14-loading #hotspots,
html.tf14-loading .compact-filter-card,
html.tf14-loading .methodology-card,
html.tf14-loading #projection,
html.tf14-loading .source-card,
html.tf14-loading footer{display:none!important}
.tf14-loading-card{margin:6px 0 18px;background:#fff;border:1px solid #e1e9f2;border-radius:22px;padding:18px 20px;box-shadow:0 10px 34px rgba(24,40,58,.06);display:flex;align-items:center;gap:14px;color:#566474}
.tf14-loading-dot{width:12px;height:12px;border-radius:50%;background:#1268e8;box-shadow:0 0 0 0 rgba(18,104,232,.28);animation:tf14pulse 1.4s ease-out infinite;flex:0 0 auto}
.tf14-loading-card b{display:block;color:#1b2330;font-size:14px;margin-bottom:3px}.tf14-loading-card span{font-size:12px;line-height:1.55;color:#74818d}
.tf14-retry{margin-top:10px;border:0;border-radius:12px;background:#1268e8;color:#fff;padding:9px 13px;font-weight:700;cursor:pointer}
@keyframes tf14pulse{0%{box-shadow:0 0 0 0 rgba(18,104,232,.28)}70%{box-shadow:0 0 0 10px rgba(18,104,232,0)}100%{box-shadow:0 0 0 0 rgba(18,104,232,0)}}
@media(max-width:760px){
  .topbar{width:100%;max-width:100%;padding:0 16px}
  .main-wrap{width:100%;max-width:100%;padding:16px 16px 28px}
  .hero{gap:0;margin-bottom:12px;align-items:start}
  .hero-copy-wrap{padding:0}
  .hero .eyebrow{font-size:10.5px;line-height:1.5;letter-spacing:.12em;margin-bottom:8px}
  .hero h1{font-size:clamp(32px,9vw,38px);line-height:1.02;letter-spacing:-.03em;margin:0 0 13px}
  .hero p{font-size:12.5px;line-height:1.62}
  .search-strip{grid-template-columns:minmax(0,1fr) 88px;gap:8px;margin-bottom:10px;padding:7px 0 9px}
  .search-trigger{min-width:0;width:100%;height:54px;padding:0 14px}
  .search-trigger-icon{font-size:24px}
  .search-trigger-copy{font-size:12.5px}
  .filter-btn{min-width:0;width:100%;height:54px;border-radius:18px;font-size:0;overflow:hidden}
  .filter-btn:after{content:'ท่วมซ้ำ';font-size:11px;font-weight:800;color:#1268e8;white-space:nowrap}
  .tf14-loading-card{margin:2px 0 16px;padding:15px 16px;border-radius:20px;gap:12px}
  .tf14-loading-card b{font-size:13px}.tf14-loading-card span{font-size:11px}
  .headline-stats{grid-template-columns:1fr 1fr;gap:8px}
  .headline-stats article{min-width:0}

  /* Province Deep Dive: keep the escape control visible and make scrolling cheap. */
  .modal{padding:0;align-items:stretch;overscroll-behavior:contain}
  .modal-backdrop{backdrop-filter:none!important;background:rgba(16,26,40,.42)}
  .modal-panel--province{width:100%!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important;padding:0 16px 24px!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;scroll-behavior:auto}
  .modal-panel--province .sticky-head{position:sticky!important;top:0!important;z-index:70!important;margin:0 -16px!important;padding:12px 66px 10px 16px!important;background:#fff!important;backdrop-filter:none!important;box-shadow:0 1px 0 #edf1f7}
  .modal-panel--province .modal-close{position:fixed!important;top:calc(env(safe-area-inset-top,0px) + 10px)!important;right:12px!important;z-index:200!important;width:48px!important;height:48px!important;border-radius:16px!important;background:#fff!important;box-shadow:0 6px 20px rgba(24,40,58,.14)!important;touch-action:manipulation}
  .modal-panel--province .mini-tabs{overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;-webkit-overflow-scrolling:touch}
  .modal-panel--province .mini-tabs::-webkit-scrollbar{display:none}
  .modal-panel--province .tab-panel.active{contain:layout style}
  .modal-panel--province .metric-grid,.modal-panel--province .pattern-grid,.modal-panel--province .event-details{box-shadow:none!important}
}
`;
document.head.appendChild(style);

document.documentElement.classList.add('tf14-loading');
const search=document.querySelector('.search-strip');
const loading=document.createElement('section');
loading.id='tf14LoadingCard';
loading.className='tf14-loading-card';
loading.setAttribute('role','status');
loading.setAttribute('aria-live','polite');
loading.innerHTML='<i class="tf14-loading-dot" aria-hidden="true"></i><div><b>กำลังโหลดฐานประวัติน้ำท่วม 14 ปี</b><span>ใช้ชุดข้อมูลที่ผ่านการตรวจครบ 77 จังหวัด</span></div>';
search?.insertAdjacentElement('afterend',loading);

let finished=false;
let finishScheduled=false;
let pollTimer=null;
let failureTimer=null;

function hasVerified14YearData(){
  const data=window.__tfHistorical14y;
  return Number(data?.provinceCount)===77
    && Number(data?.coverage?.years)===14
    && Number(data?.coverage?.startBE)===2554
    && Number(data?.coverage?.endBE)===2567;
}

function finish(){
  if(finished||!hasVerified14YearData())return;
  finished=true;
  if(pollTimer)clearInterval(pollTimer);
  if(failureTimer)clearTimeout(failureTimer);
  document.documentElement.classList.remove('tf14-loading');
  document.getElementById('tf14LoadingCard')?.remove();
  document.getElementById('tfHistorical14yGuard')?.remove();
}

function scheduleFinish(){
  if(finished||finishScheduled||!hasVerified14YearData())return;
  finishScheduled=true;
  setTimeout(finish,1700);
}

function showLoadFailure(){
  if(finished||hasVerified14YearData()){
    scheduleFinish();
    return;
  }
  const card=document.getElementById('tf14LoadingCard');
  if(!card)return;
  card.innerHTML='<div><b>โหลดฐานประวัติ 14 ปีไม่สำเร็จ</b><span>ระบบหยุดแสดงตัวเลขเก่าเพื่อป้องกันข้อมูลผิด</span><br><button class="tf14-retry" type="button">ลองใหม่</button></div>';
  card.querySelector('.tf14-retry')?.addEventListener('click',()=>location.reload());
}

window.addEventListener('tf:historical14y-ready',()=>{
  if(hasVerified14YearData())finish();
},{once:true});
window.addEventListener('tf:historical14y-data-ready',scheduleFinish,{once:true});

const bootPromise=import('/app-entry-v11.js?v=20260828-province-mobile-perf1')
  .then(()=>{if(hasVerified14YearData())scheduleFinish();})
  .catch(error=>{
    console.error('14-year UI bootstrap failed',error);
    showLoadFailure();
  });

pollTimer=setInterval(()=>{
  if(hasVerified14YearData())scheduleFinish();
},100);
failureTimer=setTimeout(showLoadFailure,21000);

await bootPromise;
if(hasVerified14YearData())scheduleFinish();

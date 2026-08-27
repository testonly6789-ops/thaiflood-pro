// Mobile-first loading polish for the 14-year dashboard.
// Keeps the existing visual theme while preventing partially-hidden cards from
// leaving large blank holes during the 14-year data fetch.
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
@keyframes tf14pulse{0%{box-shadow:0 0 0 0 rgba(18,104,232,.28)}70%{box-shadow:0 0 0 10px rgba(18,104,232,0)}100%{box-shadow:0 0 0 0 rgba(18,104,232,0)}}
@media(max-width:760px){
  .topbar{width:100%;max-width:100%;padding:0 16px}
  .main-wrap{width:100%;max-width:100%;padding:16px 16px 28px}
  .hero{gap:0;margin-bottom:12px;align-items:start}
  .hero-copy-wrap{padding:0}
  .hero .eyebrow{font-size:10.5px;line-height:1.5;letter-spacing:.12em;margin-bottom:8px}
  .hero h1{font-size:clamp(38px,10.8vw,44px);line-height:.99;letter-spacing:-.035em;margin:0 0 14px}
  .hero p{font-size:13px;line-height:1.68}
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
loading.innerHTML='<i class="tf14-loading-dot" aria-hidden="true"></i><div><b>กำลังโหลดฐานประวัติน้ำท่วม 14 ปี</b><span>กำลังรวมข้อมูล GISTDA และ ปภ. ให้ใช้ความหมายเดียวกันทั้งหน้า</span></div>';
search?.insertAdjacentElement('afterend',loading);

let finished=false;
function finish(){
  if(finished)return;
  finished=true;
  document.documentElement.classList.remove('tf14-loading');
  document.getElementById('tf14LoadingCard')?.remove();
}
window.addEventListener('tf:historical14y-ready',finish,{once:true});

await import('/app-entry-v11.js?v=20260827-historical14y-final4');

if(window.__tfHistorical14y?.coverage?.years===14)finish();
setTimeout(()=>{
  if(finished)return;
  const card=document.getElementById('tf14LoadingCard');
  if(card)card.innerHTML='<div><b>กำลังเชื่อมฐานข้อมูลนานกว่าปกติ</b><span>หน้าเว็บจะยังไม่แสดงตัวเลขประวัติ จนกว่าการตรวจข้อมูล 14 ปีจะเสร็จ</span></div>';
},18000);

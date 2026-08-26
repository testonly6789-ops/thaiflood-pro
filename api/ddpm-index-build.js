import { provinces } from './provinces.js';

const API='https://catalog.disaster.go.th/api/3/action/datastore_search';
const RESOURCES=[
  {year:2562,id:'8c477d58-3ae9-436f-9e3d-f7d302fe8197',mode:'summary',province:'Province',fields:['Province','District','households','Population','Deaths','Missing','Injured','Rice Fields','Garden Crops','Field Crops','Total Damage (THB)','Agri. Damage (THB)']},
  {year:2563,id:'27e81e82-7cdc-4fe9-94b9-f3ca193c2328',mode:'district',province:'province',district:'district',fields:['province','district']},
  {year:2564,id:'beb61961-ded4-447d-a348-8a39623e95d4',mode:'district',province:'province',district:'district',fields:['province','district']},
  {year:2565,id:'bc36c686-79f3-4574-a654-54cf0ef00d82',mode:'district',province:'province',district:'district',fields:['province','district']},
  {year:2566,id:'af2370d1-d2d0-4844-a16d-e6af34926e71',mode:'district',province:'Province',district:'District',fields:['Province','District']},
  {year:2567,id:'dde2eddc-28f5-40bf-8a62-28bc68f02af8',mode:'district',province:'Province',district:'District',fields:['Province','District']},
  {year:2568,id:'9eae087c-8931-4a74-9968-200cdb3d2fb3',mode:'summary',province:'Province',fields:['Province','Time','District','Affected Households','Affected People','fatalities_count','Missing Persons','injuries_count','Agriculture (Acres)']},
];
const THAI_DIGITS={'๐':'0','๑':'1','๒':'2','๓':'3','๔':'4','๕':'5','๖':'6','๗':'7','๘':'8','๙':'9'};
const latin=s=>String(s??'').replace(/[๐-๙]/g,d=>THAI_DIGITS[d]||d);
const num=v=>{if(v==null||v===''||v==='-'||v==='—')return null;const s=latin(v).replace(/,/g,'').replace(/[^0-9.+-]/g,'');if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null};
const positive=v=>{const n=num(v);return n!=null&&n>0};
const cleanProvince=v=>String(v??'').trim().replace(/^จังหวัด\s*/,'');
const cleanDistrict=v=>{const s=String(v??'').trim().replace(/^อำเภอ\s*/,'');return !s||/^\d+(?:\.\d+)?$/.test(latin(s))?'':s};

async function getPage(resource,offset){
  const u=new URL(API);u.searchParams.set('resource_id',resource.id);u.searchParams.set('limit','32000');u.searchParams.set('offset',String(offset));u.searchParams.set('fields',resource.fields.join(','));
  const r=await fetch(u,{headers:{'User-Agent':'ThaiFlood-Intelligence/7.1'}});if(!r.ok)throw new Error(`${resource.year}: HTTP ${r.status}`);const j=await r.json();if(!j?.success)throw new Error(`${resource.year}: CKAN success=false`);return j.result;
}
async function getAll(resource){
  const first=await getPage(resource,0);const total=Number(first.total||0);const rows=[...(first.records||[])];
  for(let offset=32000;offset<total;offset+=32000){const page=await getPage(resource,offset);rows.push(...(page.records||[]));}
  return {resource,rows,total};
}
function summaryHasFlood(year,row){
  if(year===2568)return ['Time','District','Affected Households','Affected People','fatalities_count','Missing Persons','injuries_count','Agriculture (Acres)'].some(k=>positive(row[k]));
  return ['District','households','Population','Deaths','Missing','Injured','Rice Fields','Garden Crops','Field Crops','Total Damage (THB)','Agri. Damage (THB)'].some(k=>positive(row[k]));
}

export default async function handler(req,res){
  try{
    const started=Date.now();
    const index=Object.fromEntries(provinces.map(p=>[p.name,{province:p.name,floodYearList:[],years:{}}]));
    const datasets=await Promise.all(RESOURCES.map(getAll));
    for(const {resource,rows,total} of datasets){
      const byProvince=new Map();
      for(const row of rows){const p=cleanProvince(row[resource.province]);if(!index[p])continue;if(!byProvince.has(p))byProvince.set(p,[]);byProvince.get(p).push(row);}
      for(const p of provinces.map(x=>x.name)){
        const items=byProvince.get(p)||[];let flooded=false;let districtCount=0;let recordCount=items.length;
        if(resource.mode==='district'){
          const districts=new Set(items.map(r=>cleanDistrict(r[resource.district])).filter(Boolean));districtCount=districts.size;flooded=recordCount>0&&districtCount>0;
        }else flooded=items.some(r=>summaryHasFlood(resource.year,r));
        index[p].years[resource.year]={flooded,recordCount,districtCount};if(flooded)index[p].floodYearList.push(resource.year);
      }
    }
    const out=Object.values(index).map(x=>({...x,floodYears:x.floodYearList.length,checkedYears:7,ratePct:Math.round(x.floodYearList.length/7*1000)/10}));
    res.setHeader('Cache-Control','no-store');res.status(200).json({ok:true,generatedAt:new Date().toISOString(),elapsedMs:Date.now()-started,count:out.length,provinces:out});
  }catch(e){res.status(500).json({ok:false,error:e.message});}
}

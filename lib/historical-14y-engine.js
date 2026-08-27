import * as XLSX from 'xlsx';
import { provinces as provinceMeta } from '../api/provinces.js';

const GISTDA_OLD_QUERY = 'https://gistdaportal.gistda.or.th/data/rest/services/FL_Flood/FL_RepeatedFlooding_GISTDA_50k_Y2005_Y2016/MapServer/0/query';
const DDPM_RISK_RESOURCE_ID = 'ebf3fe4f-5830-4e9d-bfca-8b869eec7446';
const DDPM_RESOURCE_SHOW = `https://catalog.disaster.go.th/api/3/action/resource_show?id=${DDPM_RISK_RESOURCE_ID}`;
const GISTDA_YEARS = [2011,2012,2013,2014,2015,2016];
const DDPM_BE_YEARS = [2560,2561,2562,2563,2564,2565,2566,2567];
const COVERAGE_CE = Array.from({length:14},(_,i)=>2011+i);
const COVERAGE_BE = COVERAGE_CE.map(y=>y+543);

let nationalPromise = null;
let ddpmWorkbookPromise = null;

function normalizeProvince(value='') {
  let s=String(value ?? '').trim().replace(/^จังหวัด/,'').replace(/^จ\./,'').replace(/\s+/g,'');
  if (['กรุงเทพ','กรุงเทพฯ','กทม','กทม.'].includes(s)) s='กรุงเทพมหานคร';
  return s;
}
function normalizeDistrict(value='') {
  return String(value ?? '').trim().replace(/^อำเภอ/,'').replace(/^อ\./,'').replace(/^เขต/,'').replace(/\s+/g,'');
}
function normalizeCode(value='',len=0) {
  const raw=String(value ?? '').trim().replace(/\.0$/,'').replace(/[^0-9]/g,'');
  return len && raw ? raw.padStart(len,'0') : raw;
}
function positive(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  const s=String(value ?? '').trim();
  if (!s || ['-','–','—','0','0.0','ไม่มี','ไม่มีข้อมูล','null','NULL','N/A','n/a'].includes(s)) return false;
  const n=Number(s.replace(/,/g,''));
  if (Number.isFinite(n)) return n > 0;
  const m=s.replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) > 0 : false;
}
function districtKey(provinceCode,districtCode,provinceName,districtName) {
  const province=normalizeProvince(provinceName);
  const district=normalizeDistrict(districtName);
  if (province && district) return `${province}|${district}`;
  const pc=normalizeCode(provinceCode,2);
  const dc=normalizeCode(districtCode,4);
  if (pc && dc) return `CODE:${pc}|${dc}`;
  return `${province}|${district}`;
}
function sourceForYear(year) { return year <= 2016 ? 'GISTDA' : 'DDPM'; }

async function fetchWithTimeout(url,options={},timeoutMs=30000) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetch(url,{...options,signal:controller.signal,headers:{'user-agent':'ThaiFlood-Pro/1.0',...(options.headers||{})}});
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
    return response;
  } finally { clearTimeout(timer); }
}
async function fetchJson(url,options={},timeoutMs=30000) {
  const response=await fetchWithTimeout(url,options,timeoutMs);
  const data=await response.json();
  if (data?.error) throw new Error(data.error.message || data.error || 'Remote API error');
  if (data?.success === false) throw new Error(data?.error?.message || 'CKAN API error');
  return data;
}
async function postArcgis(params,timeoutMs=30000) {
  const body=new URLSearchParams();
  for (const [k,v] of Object.entries(params)) if (v !== undefined && v !== null) body.set(k,String(v));
  return fetchJson(GISTDA_OLD_QUERY,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8'},body},timeoutMs);
}

async function loadGistdaDistrictYears() {
  const byDistrict=new Map();
  const sourceStats={};
  const jobs=GISTDA_YEARS.map(async year=>{
    const data=await postArcgis({
      where:`year${year}>0`,
      outFields:'pv_code,pv_tn,ap_code,ap_tn',
      returnGeometry:'false',
      returnDistinctValues:'true',
      f:'json',
    });
    const features=data.features || [];
    sourceStats[year]=features.length;
    for (const feature of features) {
      const a=feature.attributes || {};
      const provinceCode=normalizeCode(a.pv_code,2);
      const districtCode=normalizeCode(a.ap_code,4);
      const province=normalizeProvince(a.pv_tn);
      const district=normalizeDistrict(a.ap_tn);
      if (!province || !district) continue;
      const key=districtKey(provinceCode,districtCode,province,district);
      if (!byDistrict.has(key)) byDistrict.set(key,{provinceCode,districtCode,province,district,years:new Set(),sources:new Map()});
      const row=byDistrict.get(key);
      row.years.add(year);
      row.sources.set(year,'GISTDA');
    }
  });
  await Promise.all(jobs);
  return {byDistrict,sourceStats};
}

async function resolveDdpmWorkbookUrl() {
  const data=await fetchJson(DDPM_RESOURCE_SHOW,{},20000);
  const result=data?.result || {};
  const url=result.url || result.cache_url;
  if (!url) throw new Error('DDPM resource URL not found');
  return {url,name:result.name || null,format:result.format || null,lastModified:result.last_modified || result.created || null};
}
async function loadDdpmWorkbook() {
  if (!ddpmWorkbookPromise) ddpmWorkbookPromise=(async()=>{
    const meta=await resolveDdpmWorkbookUrl();
    const response=await fetchWithTimeout(meta.url,{},45000);
    const buffer=await response.arrayBuffer();
    const workbook=XLSX.read(buffer,{type:'array',cellDates:false,raw:true});
    if (!workbook.SheetNames?.length) throw new Error('DDPM XLSX has no worksheet');
    const sheet=workbook.Sheets[workbook.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(sheet,{defval:null,raw:true});
    if (!rows.length) throw new Error('DDPM XLSX has no data rows');
    return {rows,meta,sheetName:workbook.SheetNames[0]};
  })().catch(error=>{ddpmWorkbookPromise=null;throw error;});
  return ddpmWorkbookPromise;
}

function getField(row,candidates) {
  for (const key of candidates) if (Object.prototype.hasOwnProperty.call(row,key)) return row[key];
  const keys=Object.keys(row);
  for (const candidate of candidates) {
    const target=String(candidate).replace(/\s+/g,'').toLowerCase();
    const found=keys.find(k=>String(k).replace(/\s+/g,'').toLowerCase()===target);
    if (found !== undefined) return row[found];
  }
  return null;
}
function hasYearField(row,year) {
  const target=String(year).replace(/\s+/g,'');
  return Object.keys(row).some(k=>String(k).replace(/\s+/g,'')===target);
}

async function loadDdpmDistrictYears() {
  const {rows,meta,sheetName}=await loadDdpmWorkbook();
  const first=rows[0] || {};
  const missingYearFields=DDPM_BE_YEARS.filter(y=>!hasYearField(first,y));
  if (missingYearFields.length) throw new Error(`DDPM workbook missing year fields: ${missingYearFields.join(',')}`);

  const byDistrict=new Map();
  const sourceStats=Object.fromEntries(DDPM_BE_YEARS.map(y=>[y-543,0]));
  const provinceNames=new Set();
  let positiveVillageYearCells=0;

  for (const row of rows) {
    const provinceCode=normalizeCode(getField(row,['รหัสจังหวัด','PROVINCE_CODE','prov_id']),2);
    const province=normalizeProvince(getField(row,['จังหวัด','PROVINCE_NAME','prov_name']));
    const districtCode=normalizeCode(getField(row,['รหัสอำเภอ','AMPHUR_CODE','amp_id']),4);
    const district=normalizeDistrict(getField(row,['อำเภอ','AMPHUR_NAME','amp_name']));
    if (!province || !district) continue;
    provinceNames.add(province);
    const key=districtKey(provinceCode,districtCode,province,district);
    if (!byDistrict.has(key)) byDistrict.set(key,{provinceCode,districtCode,province,district,years:new Set(),sources:new Map(),positiveVillageYearCells:0});
    const target=byDistrict.get(key);
    for (const be of DDPM_BE_YEARS) {
      const value=getField(row,[String(be),be]);
      if (!positive(value)) continue;
      const ce=be-543;
      target.years.add(ce);
      target.sources.set(ce,'DDPM');
      target.positiveVillageYearCells += 1;
      sourceStats[ce] += 1;
      positiveVillageYearCells += 1;
    }
  }
  return {byDistrict,sourceStats,meta,sheetName,rowCount:rows.length,provinceCount:provinceNames.size,positiveVillageYearCells};
}

function mergeDistrictMaps(gistda,ddpm) {
  const merged=new Map();
  const put=(sourceMap)=>{
    for (const [key,row] of sourceMap.entries()) {
      if (!merged.has(key)) merged.set(key,{provinceCode:row.provinceCode,districtCode:row.districtCode,province:row.province,district:row.district,years:new Set(),sources:new Map()});
      const target=merged.get(key);
      if (!target.province && row.province) target.province=row.province;
      if (!target.district && row.district) target.district=row.district;
      if (!target.provinceCode && row.provinceCode) target.provinceCode=row.provinceCode;
      if (!target.districtCode && row.districtCode) target.districtCode=row.districtCode;
      for (const year of row.years || []) {
        target.years.add(year);
        target.sources.set(year,row.sources?.get(year) || sourceForYear(year));
      }
    }
  };
  put(gistda); put(ddpm);
  return merged;
}

function buildNationalPayload(merged,gistdaInfo,ddpmInfo,started) {
  const byProvince=new Map();
  for (const meta of provinceMeta) byProvince.set(normalizeProvince(meta.name),{province:meta.name,region:meta.region,lat:meta.lat,lon:meta.lon,districts:[]});

  const unmatched=[];
  for (const row of merged.values()) {
    const pname=normalizeProvince(row.province);
    const provinceRow=byProvince.get(pname);
    if (!provinceRow) { unmatched.push({province:row.province,district:row.district,provinceCode:row.provinceCode,districtCode:row.districtCode}); continue; }
    const years=[...row.years].filter(y=>y>=2011&&y<=2024).sort((a,b)=>a-b);
    if (!years.length) continue;
    provinceRow.districts.push({
      district:row.district,
      districtCode:row.districtCode || null,
      years,
      beYears:years.map(y=>y+543),
      yearCount:years.length,
      recurring:years.length>=2,
      sourceYears:Object.fromEntries(years.map(y=>[y,row.sources.get(y) || sourceForYear(y)])),
    });
  }

  const provinces=[];
  for (const p of byProvince.values()) {
    p.districts.sort((a,b)=>b.yearCount-a.yearCount || a.district.localeCompare(b.district,'th'));
    const recurring=p.districts.filter(d=>d.recurring);
    const yearDistrictCounts=Object.fromEntries(COVERAGE_CE.map(y=>[y,p.districts.filter(d=>d.years.includes(y)).length]));
    provinces.push({
      province:p.province,region:p.region,lat:p.lat,lon:p.lon,ok:true,
      districtCountWithAnyHistory:p.districts.length,
      recurringDistrictCount:recurring.length,
      maxYears:p.districts[0]?.yearCount || 0,
      checkedYears:14,
      checkedYearList:COVERAGE_BE,
      yearDistrictCounts,
      topDistricts:recurring.slice(0,12).map(d=>({district:d.district,yearCount:d.yearCount,years:d.beYears})),
      ranking:p.districts,
    });
  }
  provinces.sort((a,b)=>a.province.localeCompare(b.province,'th'));
  const ranked=provinces.slice().sort((a,b)=>b.recurringDistrictCount-a.recurringDistrictCount || b.maxYears-a.maxYears || a.province.localeCompare(b.province,'th'));
  const allDistricts=provinces.flatMap(p=>(p.ranking || []).map(d=>({province:p.province,...d})));
  const recurringDistricts=allDistricts.filter(d=>d.recurring);
  const sourceCoverage={
    gistda:{years:GISTDA_YEARS,positiveDistrictCountsByYear:gistdaInfo.sourceStats},
    ddpm:{years:DDPM_BE_YEARS.map(y=>y-543),positiveVillageYearCellsByYear:ddpmInfo.sourceStats,workbookRows:ddpmInfo.rowCount,workbookProvinceCount:ddpmInfo.provinceCount,resourceName:ddpmInfo.meta.name,resourceLastModified:ddpmInfo.meta.lastModified},
  };
  const qc={
    expectedProvinceCount:77,
    provinceCount:provinces.length,
    coverageYearCount:COVERAGE_CE.length,
    missingCoverageYears:COVERAGE_CE.filter(y=>!(y<=2016 ? Object.prototype.hasOwnProperty.call(gistdaInfo.sourceStats,y) : Object.prototype.hasOwnProperty.call(ddpmInfo.sourceStats,y))),
    unmatchedDistrictRows:unmatched,
    ddpmProvinceCount:ddpmInfo.provinceCount,
    totalDistrictsWithAnyHistory:allDistricts.length,
    passed:provinces.length===77 && COVERAGE_CE.length===14 && unmatched.length===0 && ddpmInfo.provinceCount>=76 && allDistricts.length<=928,
  };

  return {
    ok:qc.passed,
    source:'GISTDA + กรมป้องกันและบรรเทาสาธารณภัย (ปภ.)',
    definition:'พื้นที่ท่วมซ้ำ = อำเภอเดิมที่มีหลักฐานการเกิดอุทกภัยอย่างน้อย 2 ปี ในช่วงย้อนหลัง 14 ปี พ.ศ. 2554–2567',
    methodology:{
      gistda:'พ.ศ. 2554–2559: พื้นที่น้ำท่วมซ้ำซาก GISTDA ปี 2005–2016 ใช้ธงรายปีและชื่ออำเภอโดยตรง',
      ddpm:'พ.ศ. 2560–2567: ชุดข้อมูล ปภ. หมู่บ้านที่อยู่ในพื้นที่เสี่ยงเกิดอุทกภัย ใช้จำนวนครั้งที่เกิดอุทกภัยรายหมู่บ้านในแต่ละปี แล้วรวมขึ้นระดับอำเภอ',
      districtRule:'ถือว่าอำเภอมีอุทกภัยในปีนั้นเมื่อมีอย่างน้อยหนึ่งพื้นที่/หมู่บ้านในอำเภอมีค่าการเกิดอุทกภัยมากกว่า 0',
      matchingRule:'จับคู่สองแหล่งด้วยชื่อจังหวัด + ชื่ออำเภอที่ปรับรูปแบบให้ตรงกัน โดยใช้รหัสเป็นข้อมูลประกอบ ไม่ใช้เป็นกุญแจหลัก',
      missingRule:'ข้อมูลขาดจะไม่ถูกตีความเป็นไม่ท่วม',
    },
    coverage:{startCE:2011,endCE:2024,startBE:2554,endBE:2567,years:14,yearListBE:COVERAGE_BE},
    sources:[
      {name:'GISTDA พื้นที่น้ำท่วมซ้ำซาก ปี 2005–2016',url:'https://gistdaportal.gistda.or.th/data/rest/services/FL_Flood/FL_RepeatedFlooding_GISTDA_50k_Y2005_Y2016/MapServer/0'},
      {name:'ปภ. หมู่บ้านที่อยู่ในพื้นที่เสี่ยงเกิดอุทกภัย',url:'https://catalog.disaster.go.th/dataset/dpm-gd017'},
    ],
    provinceCount:provinces.length,
    checkedProvinceCount:provinces.length,
    failedProvinceCount:qc.passed?0:1,
    totalDistrictsWithAnyHistory:allDistricts.length,
    totalRecurringDistricts:recurringDistricts.length,
    recurringProvinceCount:provinces.filter(p=>p.recurringDistrictCount>0).length,
    maxYears:Math.max(0,...provinces.map(p=>p.maxYears)),
    topProvince:ranked[0] || null,
    ranked,
    provinces,
    sourceCoverage,
    qc,
    elapsedMs:Date.now()-started,
  };
}

export async function buildHistoricalNational({force=false}={}) {
  if (force) nationalPromise=null;
  if (!nationalPromise) nationalPromise=(async()=>{
    const started=Date.now();
    const [gistdaInfo,ddpmInfo]=await Promise.all([loadGistdaDistrictYears(),loadDdpmDistrictYears()]);
    const merged=mergeDistrictMaps(gistdaInfo.byDistrict,ddpmInfo.byDistrict);
    return buildNationalPayload(merged,gistdaInfo,ddpmInfo,started);
  })().catch(error=>{nationalPromise=null;throw error;});
  return nationalPromise;
}

export async function buildHistoricalProvince(province) {
  const national=await buildHistoricalNational();
  const name=normalizeProvince(province);
  const found=national.provinces.find(p=>normalizeProvince(p.province)===name);
  if (!found) throw new Error(`ไม่พบจังหวัด ${province}`);
  return {
    ok:national.ok,
    province:found.province,
    coverage:national.coverage,
    definition:national.definition,
    methodology:national.methodology,
    sources:national.sources,
    districtCount:found.districtCountWithAnyHistory,
    recurringDistrictCount:found.recurringDistrictCount,
    maxYears:found.maxYears,
    topDistricts:found.topDistricts,
    yearDistrictCounts:found.yearDistrictCounts,
    ranking:found.ranking,
    districts:found.ranking,
    qc:national.qc,
    elapsedMs:national.elapsedMs,
  };
}

export async function auditHistoricalSources() {
  const payload=await buildHistoricalNational({force:true});
  return {ok:payload.ok,coverage:payload.coverage,sourceCoverage:payload.sourceCoverage,qc:payload.qc,provinceCount:payload.provinceCount,totalDistrictsWithAnyHistory:payload.totalDistrictsWithAnyHistory,totalRecurringDistricts:payload.totalRecurringDistricts,maxYears:payload.maxYears,topProvince:payload.topProvince,elapsedMs:payload.elapsedMs};
}

export async function probeGistdaSpatial(province) {
  const payload=await buildHistoricalProvince(province);
  return {ok:payload.ok,province:payload.province,coverage:payload.coverage,recurringDistrictCount:payload.recurringDistrictCount,maxYears:payload.maxYears,qc:payload.qc};
}

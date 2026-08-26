const ADMIN_URL='https://gistdaportal.gistda.or.th/data/rest/services/L05_AdminBoundary/L05_Amphoe_GISTDA_50k/MapServer/0/query';
const OLD_URL='https://gistdaportal.gistda.or.th/data/rest/services/FL_Flood/FL_RepeatedFlooding_GISTDA_50k_Y2005_Y2016/MapServer/0/query';
const NEW_URL='https://gistdaportal.gistda.or.th/data/rest/services/FL_Flood/flood_freq11_20/MapServer/0/query';

function esc(v=''){return String(v).replace(/'/g,"''");}
async function query(url,params){
  const body=new URLSearchParams();
  for(const [k,v] of Object.entries(params)) body.set(k,String(v));
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8','user-agent':'ThaiFlood-Pro/1.0'},body});
  if(!r.ok) throw new Error(`GISTDA HTTP ${r.status}`);
  const data=await r.json();
  if(data?.error) throw new Error(data.error.message||'GISTDA query error');
  return data;
}

export async function auditGistdaHistoricalSources(province){
  const admin=await query(ADMIN_URL,{where:`PV_TN='${esc(province)}'`,outFields:'PV_CODE,PV_TN',returnGeometry:'false',resultRecordCount:'1',f:'json'});
  const provinceCode=String(admin.features?.[0]?.attributes?.PV_CODE||'').trim();
  if(!provinceCode) throw new Error('ไม่พบรหัสจังหวัดจาก GISTDA');
  const oldClause=`pv_code='${esc(provinceCode)}'`;
  const newClause=`PV_CODE='${esc(provinceCode)}'`;

  const oldYearFields=[2011,2012,2013,2014,2015,2016];
  const newYearFields=[2017,2018,2019,2020];
  const jobs=[];
  jobs.push(query(OLD_URL,{where:oldClause,returnCountOnly:'true',f:'json'}));
  // This legacy ArcGIS layer rejects pagination parameters. Distinct values work without them.
  jobs.push(query(OLD_URL,{where:oldClause,outFields:'ap_tn,ap_code,pv_tn,pv_code',returnGeometry:'false',returnDistinctValues:'true',f:'json'}));
  for(const y of oldYearFields) jobs.push(query(OLD_URL,{where:`${oldClause} AND year${y}>0`,returnCountOnly:'true',f:'json'}));
  jobs.push(query(NEW_URL,{where:newClause,returnCountOnly:'true',f:'json'}));
  for(const y of newYearFields){
    const field=y===2017?'Y2017':`Y_${y}`;
    jobs.push(query(NEW_URL,{where:`${newClause} AND ${field}>0`,returnCountOnly:'true',f:'json'}));
  }
  jobs.push(query(NEW_URL,{where:'1=1',outFields:'PV_CODE,PV_TN',returnGeometry:'false',returnDistinctValues:'true',orderByFields:'PV_CODE',resultRecordCount:'200',f:'json'}));

  const out=await Promise.all(jobs);
  let i=0;
  const oldTotal=Number(out[i++].count||0);
  const oldDistricts=(out[i++].features||[]).map(f=>f.attributes);
  const oldYears={}; for(const y of oldYearFields) oldYears[y]=Number(out[i++].count||0);
  const newTotal=Number(out[i++].count||0);
  const newYears={}; for(const y of newYearFields) newYears[y]=Number(out[i++].count||0);
  const newProvinceValues=(out[i++].features||[]).map(f=>f.attributes);

  return {
    ok:true,province,provinceCode,
    old2005to2016:{featureCount:oldTotal,districtCount:new Set(oldDistricts.map(x=>x.ap_code)).size,districts:oldDistricts,positiveFeatureCountsByYear:oldYears},
    new2011to2020:{featureCount:newTotal,positiveFeatureCountsByYear:newYears,coveredProvinceCount:newProvinceValues.length,coveredProvinces:newProvinceValues},
  };
}

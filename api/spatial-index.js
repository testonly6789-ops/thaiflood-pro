import { provinces } from './provinces.js';
import ddpmHandler from './ddpm-fast-v5.js';

function runProvince(province) {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const req = { query: { province } };
    const res = {
      setHeader() { return this; },
      status(code) { statusCode = code; return this; },
      json(payload) { resolve({ statusCode, payload }); return payload; },
    };
    Promise.resolve(ddpmHandler(req, res)).catch(reject);
  });
}

async function runPool(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  async function one() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, one));
  return out;
}

export default async function handler(req, res) {
  const started = Date.now();
  const rows = await runPool(provinces, 10, async p => {
    try {
      const { statusCode, payload } = await runProvince(p.name);
      const spatial = payload?.spatialRecurrence;
      const ranking = Array.isArray(spatial?.ranking) ? spatial.ranking : [];
      if (statusCode !== 200 || !payload?.ok || !spatial) {
        return { province:p.name, region:p.region, lat:p.lat, lon:p.lon, ok:false, recurringDistrictCount:0, maxYears:0, checkedYears:0, topDistricts:[], ranking:[] };
      }
      return {
        province:p.name,
        region:p.region,
        lat:p.lat,
        lon:p.lon,
        ok:true,
        recurringDistrictCount:Number(spatial.recurringDistrictCount || 0),
        maxYears:Number(spatial.maxYears || 0),
        checkedYears:Number(spatial.checkedYearCount || 0),
        checkedYearList:spatial.checkedYears || [],
        topDistricts:spatial.topDistricts || [],
        ranking:ranking.filter(x => Number(x.yearCount || 0) >= 2).slice(0,8),
      };
    } catch (error) {
      return { province:p.name, region:p.region, lat:p.lat, lon:p.lon, ok:false, error:error.message || String(error), recurringDistrictCount:0, maxYears:0, checkedYears:0, topDistricts:[], ranking:[] };
    }
  });

  const usable = rows.filter(x => x.ok && x.checkedYears > 0);
  const recurring = usable.filter(x => x.recurringDistrictCount > 0)
    .sort((a,b) => b.recurringDistrictCount - a.recurringDistrictCount || b.maxYears - a.maxYears || a.province.localeCompare(b.province,'th'));
  const totalRecurringDistricts = usable.reduce((sum,x) => sum + x.recurringDistrictCount, 0);
  const maxYears = usable.length ? Math.max(...usable.map(x => x.maxYears)) : 0;
  const checkedYearCounts = [...new Set(usable.map(x => x.checkedYears))].sort((a,b)=>a-b);
  const compact = String(req.query?.compact || '') === '1';
  const compactRows = rows.map(x => ({
    province:x.province,
    recurringDistrictCount:x.recurringDistrictCount,
    maxYears:x.maxYears,
    checkedYears:x.checkedYears,
    topDistricts:(x.topDistricts || []).slice(0,3),
    topRanking:(x.ranking || []).slice(0,3),
  }));

  res.setHeader('Cache-Control','public, max-age=300');
  res.setHeader('CDN-Cache-Control','public, s-maxage=21600, stale-while-revalidate=86400');
  res.setHeader('Vercel-CDN-Cache-Control','public, s-maxage=21600, stale-while-revalidate=86400');
  return res.status(200).json({
    ok:usable.length === provinces.length,
    source:'กรมป้องกันและบรรเทาสาธารณภัย (ปภ.)',
    definition:'พื้นที่ท่วมซ้ำ = อำเภอเดิมที่มีรายงานอุทกภัยอย่างน้อย 2 ปี ในปีที่มีชื่ออำเภอเปรียบเทียบกันได้',
    coverage:{ start:2563, end:2567, years:5 },
    provinceCount:provinces.length,
    checkedProvinceCount:usable.length,
    failedProvinceCount:provinces.length-usable.length,
    totalRecurringDistricts,
    recurringProvinceCount:recurring.length,
    maxYears,
    checkedYearCounts,
    topProvince:recurring[0] || null,
    ...(compact ? { provinces:compactRows } : { ranked:recurring, provinces:rows }),
    elapsedMs:Date.now()-started,
  });
}

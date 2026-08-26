import { provinces } from './provinces.js';

const API = 'https://catalog.disaster.go.th/api/3/action/datastore_search';
const YEARS = [
  { year:2562, id:'8c477d58-3ae9-436f-9e3d-f7d302fe8197', mode:'summary', province:'Province', fields:['Province','District','households','Population','Deaths','Missing','Injured','Rice Fields','Garden Crops','Field Crops','Total Damage (THB)','Agri. Damage (THB)'] },
  { year:2563, id:'27e81e82-7cdc-4fe9-94b9-f3ca193c2328', mode:'district', province:'province', fields:['province','district'] },
  { year:2564, id:'beb61961-ded4-447d-a348-8a39623e95d4', mode:'district', province:'province', fields:['province','district'] },
  { year:2565, id:'bc36c686-79f3-4574-a654-54cf0ef00d82', mode:'district', province:'province', fields:['province','district'] },
  { year:2566, id:'af2370d1-d2d0-4844-a16d-e6af34926e71', mode:'district', province:'Province', fields:['Province','District'] },
  { year:2567, id:'dde2eddc-28f5-40bf-8a62-28bc68f02af8', mode:'district', province:'Province', fields:['Province','District'] },
  { year:2568, id:'9eae087c-8931-4a74-9968-200cdb3d2fb3', mode:'summary', province:'Province', fields:['Province','Time','District','Affected Households','Affected People','fatalities_count','Missing Persons','injuries_count','Agriculture (Acres)'] },
];

const THAI_DIGITS = { '๐':'0','๑':'1','๒':'2','๓':'3','๔':'4','๕':'5','๖':'6','๗':'7','๘':'8','๙':'9' };
const latinize = (s='') => String(s ?? '').replace(/[๐-๙]/g, d => THAI_DIGITS[d] || d);
const num = (v) => {
  if (v == null || v === '' || v === '-' || v === '—') return null;
  const cleaned = latinize(v).replace(/,/g,'').replace(/[^0-9.+-]/g,'');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};
const positive = (v) => { const n = num(v); return n != null && n > 0; };

async function query(resource, province) {
  const u = new URL(API);
  u.searchParams.set('resource_id', resource.id);
  u.searchParams.set('limit', '1');
  u.searchParams.set('fields', resource.fields.join(','));
  u.searchParams.set('filters', JSON.stringify({ [resource.province]: province }));
  const r = await fetch(u, { headers:{ 'User-Agent':'ThaiFlood-Intelligence/8.0' } });
  if (!r.ok) throw new Error(`${resource.year}/${province}: HTTP ${r.status}`);
  const data = await r.json();
  if (!data?.success) throw new Error(`${resource.year}/${province}: CKAN success=false`);
  return data.result || {};
}

function summaryHasFlood(year, rows) {
  if (year === 2568) {
    return rows.some(row => ['Time','District','Affected Households','Affected People','fatalities_count','Missing Persons','injuries_count','Agriculture (Acres)'].some(k => positive(row[k])));
  }
  return rows.some(row => ['District','households','Population','Deaths','Missing','Injured','Rice Fields','Garden Crops','Field Crops','Total Damage (THB)','Agri. Damage (THB)'].some(k => positive(row[k])));
}

async function runPool(tasks, limit = 18) {
  const out = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= tasks.length) return;
      out[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return out;
}

export default async function handler(req, res) {
  try {
    const started = Date.now();
    const tasks = [];
    const meta = [];
    for (const resource of YEARS) {
      for (const p of provinces) {
        meta.push([resource, p.name]);
        tasks.push(() => query(resource, p.name));
      }
    }

    const results = await runPool(tasks, 18);
    const index = Object.fromEntries(provinces.map(p => [p.name, { province:p.name, floodYearList:[] }]));

    for (let i = 0; i < results.length; i += 1) {
      const [resource, province] = meta[i];
      const result = results[i];
      const rows = result.records || [];
      const flooded = resource.mode === 'district'
        ? Number(result.total || 0) > 0
        : summaryHasFlood(resource.year, rows);
      if (flooded) index[province].floodYearList.push(resource.year);
    }

    const list = Object.values(index).map(item => ({
      province:item.province,
      floodYears:item.floodYearList.length,
      floodYearList:item.floodYearList,
      checkedYears:7,
      ratePct:Math.round((item.floodYearList.length / 7) * 1000) / 10,
    }));

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('CDN-Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000');
    return res.status(200).json({
      ok:true,
      source:'กรมป้องกันและบรรเทาสาธารณภัย (ปภ.)',
      coverage:{ start:2562, end:2568, years:7 },
      generatedAt:new Date().toISOString(),
      elapsedMs:Date.now()-started,
      count:list.length,
      provinces:list,
    });
  } catch (error) {
    return res.status(500).json({ ok:false, error:error.message || String(error) });
  }
}

import { provinces } from './provinces.js';
import ddpmHandler, { ACRE_TO_RAI } from './ddpm-fast-v4.js';

const PROD_INDEX = 'https://thaiflood-pro.vercel.app/api/ddpm-index';

function runProvince(province) {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const req = { query: { province } };
    const res = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; return this; },
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

const numericOnly = (value) => /^\d+(?:\.\d+)?$/.test(String(value || '').trim());
const closeEnough = (a,b) => Math.abs(Number(a)-Number(b)) <= Math.max(0.01, Math.abs(Number(b))*1e-9);

export default async function handler(req, res) {
  const offset = Math.max(0, Number(req.query?.offset || 0));
  const limit = Math.max(1, Math.min(12, Number(req.query?.limit || 10)));
  const slice = provinces.slice(offset, offset + limit).map(p => p.name);
  const started = Date.now();

  let indexMap = new Map();
  try {
    const r = await fetch(PROD_INDEX, { headers: { 'User-Agent': 'ThaiFlood-Audit/2.0' } });
    const j = await r.json();
    if (j?.ok && Array.isArray(j.provinces)) indexMap = new Map(j.provinces.map(x => [x.province, x]));
  } catch {}

  const raw = await runPool(slice, 3, async (province) => {
    try {
      const { statusCode, payload } = await runProvince(province);
      const status = Array.isArray(payload?.status) ? payload.status : [];
      const detailYears = Array.isArray(payload?.years) ? payload.years : [];
      const summaryYears = Array.isArray(payload?.provinceSummaryYears) ? payload.provinceSummaryYears : [];
      const allYears = [...detailYears, ...summaryYears];
      const liveYears = Array.isArray(payload?.summary?.floodYearList) ? payload.summary.floodYearList.map(Number) : [];
      const index = indexMap.get(province);
      const indexYears = Array.isArray(index?.floodYearList) ? index.floodYearList.map(Number) : [];
      const numericDistricts = detailYears.flatMap(y => y.districts || []).filter(numericOnly);
      const failedSources = status.filter(x => !x.ok).map(x => ({ year:x.year, error:x.error }));
      const duplicateYears = liveYears.filter((y, i, a) => a.indexOf(y) !== i);
      const missingEvidenceYears = liveYears.filter(year => {
        const y = allYears.find(x => Number(x.year) === Number(year));
        if (!y) return true;
        if (y.evidenceLevel === 'district-detail') return !(Number(y.recordCount || 0) > 0 && Number(y.districtCount || 0) > 0);
        return ![y.occurrenceCount,y.districtCount,y.households,y.population,y.deaths,y.missing,y.injured,y.agriSourceValue,y.totalDamageThb,y.agriDamageThb]
          .some(v => Number.isFinite(Number(v)) && Number(v) > 0);
      });
      const unitIssues = [];
      for (const y of allYears) {
        const year = Number(y.year);
        if ((year === 2567 || year === 2568) && y.agriSourceValue != null) {
          if (y.agriSourceUnit !== 'acre') unitIssues.push(`${year}: source unit must be acre`);
          const expected = Number(y.agriSourceValue) * ACRE_TO_RAI;
          if (y.agriRai == null || !closeEnough(y.agriRai, expected)) unitIssues.push(`${year}: acre-to-rai conversion mismatch`);
        }
        if ((year === 2562 || year === 2566) && y.agriSourceValue != null) {
          if (y.agriSourceUnit !== 'unspecified') unitIssues.push(`${year}: unit must remain unspecified`);
          if (y.agriRai != null) unitIssues.push(`${year}: must not assume raw value is rai`);
        }
      }
      const latestComparable = allYears.filter(y => y.agriRai != null).sort((a,b)=>Number(b.year)-Number(a.year))[0] || null;
      if ((payload?.summary?.agriRai ?? null) !== (latestComparable?.agriRai ?? null)) unitIssues.push('summary agriculture must use latest comparable year, not a cross-year sum');
      const indexMatches = JSON.stringify(indexYears) === JSON.stringify(liveYears);
      return {
        province,
        ok: statusCode === 200 && payload?.ok === true,
        sourceYearsOk: failedSources.length === 0,
        failedSources,
        liveFloodYears: liveYears,
        indexFloodYears: indexYears,
        indexMatches,
        numericDistricts,
        duplicateYears,
        missingEvidenceYears,
        unitIssues,
        agricultureLatest: payload?.summary?.agriLatest ?? null,
      };
    } catch (error) {
      return { province, ok:false, error:error.message || String(error), unitIssues:['audit execution failed'] };
    }
  });

  const issues = raw.filter(x => !x.ok || !x.sourceYearsOk || !x.indexMatches || x.numericDistricts?.length || x.duplicateYears?.length || x.missingEvidenceYears?.length || x.unitIssues?.length);
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({ ok:issues.length===0, offset, limit, checked:raw.length, totalProvinces:provinces.length, elapsedMs:Date.now()-started, issueCount:issues.length, issues, results:raw });
}

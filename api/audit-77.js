import { provinces } from './provinces.js';
import ddpmHandler from './ddpm-fast-v3.js';

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

export default async function handler(req, res) {
  const offset = Math.max(0, Number(req.query?.offset || 0));
  const limit = Math.max(1, Math.min(12, Number(req.query?.limit || 10)));
  const slice = provinces.slice(offset, offset + limit).map(p => p.name);
  const started = Date.now();

  let indexMap = new Map();
  try {
    const r = await fetch(PROD_INDEX, { headers: { 'User-Agent': 'ThaiFlood-Audit/1.0' } });
    const j = await r.json();
    if (j?.ok && Array.isArray(j.provinces)) indexMap = new Map(j.provinces.map(x => [x.province, x]));
  } catch {}

  const raw = await runPool(slice, 3, async (province) => {
    try {
      const { statusCode, payload } = await runProvince(province);
      const status = Array.isArray(payload?.status) ? payload.status : [];
      const detailYears = Array.isArray(payload?.years) ? payload.years : [];
      const summaryYears = Array.isArray(payload?.provinceSummaryYears) ? payload.provinceSummaryYears : [];
      const liveYears = Array.isArray(payload?.summary?.floodYearList) ? payload.summary.floodYearList.map(Number) : [];
      const index = indexMap.get(province);
      const indexYears = Array.isArray(index?.floodYearList) ? index.floodYearList.map(Number) : [];
      const numericDistricts = detailYears.flatMap(y => y.districts || []).filter(numericOnly);
      const failedSources = status.filter(x => !x.ok).map(x => ({ year:x.year, error:x.error }));
      const duplicateYears = liveYears.filter((y, i, a) => a.indexOf(y) !== i);
      const missingEvidenceYears = liveYears.filter(year => {
        const y = [...detailYears, ...summaryYears].find(x => Number(x.year) === Number(year));
        if (!y) return true;
        if (y.evidenceLevel === 'district-detail') return !(Number(y.recordCount || 0) > 0 && Number(y.districtCount || 0) > 0);
        return ![y.occurrenceCount,y.districtCount,y.households,y.population,y.deaths,y.missing,y.injured,y.agriRai,y.totalDamageThb,y.agriDamageThb]
          .some(v => Number.isFinite(Number(v)) && Number(v) > 0);
      });
      const indexMatches = JSON.stringify(indexYears) === JSON.stringify(liveYears);
      return {
        province,
        ok: statusCode === 200 && payload?.ok === true,
        sourceYearsOk: failedSources.length === 0,
        failedSources,
        liveFloodYears: liveYears,
        liveFloodYearCount: liveYears.length,
        indexFloodYears: indexYears,
        indexMatches,
        detailYearCount: detailYears.length,
        summaryYearCount: summaryYears.length,
        numericDistricts,
        duplicateYears,
        missingEvidenceYears,
        households: payload?.summary?.households ?? null,
        agricultureRawMixedUnit: payload?.summary?.agriRai ?? null,
        damageM: payload?.summary?.totalDamageM ?? null,
      };
    } catch (error) {
      return { province, ok:false, error:error.message || String(error) };
    }
  });

  const issues = raw.filter(x => !x.ok || !x.sourceYearsOk || !x.indexMatches || x.numericDistricts?.length || x.duplicateYears?.length || x.missingEvidenceYears?.length);
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({
    ok: issues.length === 0,
    offset,
    limit,
    checked: raw.length,
    totalProvinces: provinces.length,
    elapsedMs: Date.now() - started,
    issueCount: issues.length,
    issues,
    results: raw,
  });
}

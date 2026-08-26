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
  const offset = Math.max(0, Number(req.query?.offset || 0));
  const limit = Math.max(1, Math.min(12, Number(req.query?.limit || 10)));
  const slice = provinces.slice(offset, offset + limit).map(p => p.name);
  const started = Date.now();

  const results = await runPool(slice, 3, async province => {
    try {
      const { statusCode, payload } = await runProvince(province);
      const spatial = payload?.spatialRecurrence;
      const ranking = Array.isArray(spatial?.ranking) ? spatial.ranking : [];
      const numeric = ranking.filter(x => /^\d+(?:\.\d+)?$/.test(String(x.district || '').trim()));
      const max = Number(spatial?.maxYears || 0);
      const checked = Number(spatial?.checkedYearCount || 0);
      const top = spatial?.topDistricts || [];
      const rankingMax = ranking.length ? Math.max(...ranking.map(x => Number(x.yearCount || 0))) : 0;
      const sourceFailed = (payload?.status || []).filter(s => !s.ok).map(s => s.year);
      const issues = [];
      if (statusCode !== 200 || !payload?.ok) issues.push('api failed');
      if (sourceFailed.length) issues.push(`source failed: ${sourceFailed.join(',')}`);
      if (checked !== 5) issues.push(`checked district years must be 5, got ${checked}`);
      if (max < 0 || max > checked) issues.push(`max out of range: ${max}/${checked}`);
      if (max !== rankingMax) issues.push(`max mismatch: ${max} vs ranking ${rankingMax}`);
      if (max >= 2 && !top.length) issues.push('missing top districts');
      if (numeric.length) issues.push('numeric district code leaked');
      for (const x of ranking) {
        const years = [...new Set((x.years || []).map(Number))];
        if (years.length !== Number(x.yearCount || 0)) issues.push(`yearCount mismatch ${x.district}`);
        if (years.some(y => y < 2563 || y > 2567)) issues.push(`invalid spatial year ${x.district}`);
      }
      return { province, ok:issues.length===0, issues, maxYears:max, checkedYears:checked, topDistricts:top, recurringDistrictCount:spatial?.recurringDistrictCount || 0 };
    } catch (error) {
      return { province, ok:false, issues:[error.message || String(error)] };
    }
  });

  const issues = results.filter(x => !x.ok);
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({ ok:issues.length===0, offset, checked:results.length, totalProvinces:provinces.length, elapsedMs:Date.now()-started, issueCount:issues.length, issues, results });
}

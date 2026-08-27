import { auditHistoricalSources, buildHistoricalNational, buildHistoricalProvince } from '../lib/historical-14y-engine.js';

console.log('[historical14y-qc] start');
const audit = await auditHistoricalSources();
const national = await buildHistoricalNational();
const allDistricts = (national.provinces || []).flatMap(p => (p.ranking || []).map(d => ({province:p.province,...d})));
const distribution = Object.fromEntries(Array.from({length:14},(_,i)=>i+1).map(n => [n, allDistricts.filter(d => Number(d.yearCount) === n).length]));
const thresholds = Object.fromEntries([2,4,7,8,10,12].map(n => [n, allDistricts.filter(d => Number(d.yearCount) >= n).length]));
const provincePersistent = (national.provinces || []).map(p => ({
  province:p.province,
  ge7:(p.ranking || []).filter(d => Number(d.yearCount) >= 7).length,
  ge10:(p.ranking || []).filter(d => Number(d.yearCount) >= 10).length,
  maxYears:p.maxYears,
})).sort((a,b)=>b.ge7-a.ge7 || b.ge10-a.ge10 || b.maxYears-a.maxYears || a.province.localeCompare(b.province,'th'));

console.log('[historical14y-qc] national=' + JSON.stringify({
  ok:audit.ok,
  coverage:audit.coverage,
  provinceCount:audit.provinceCount,
  totalDistrictsWithAnyHistory:audit.totalDistrictsWithAnyHistory,
  totalRecurringDistricts:audit.totalRecurringDistricts,
  maxYears:audit.maxYears,
  topProvince:audit.topProvince ? {province:audit.topProvince.province,recurringDistrictCount:audit.topProvince.recurringDistrictCount,maxYears:audit.topProvince.maxYears} : null,
  sourceCoverage:audit.sourceCoverage,
  qc:audit.qc,
  elapsedMs:audit.elapsedMs,
}));
console.log('[historical14y-qc] distribution=' + JSON.stringify({distribution,thresholds,topPersistentProvinces:provincePersistent.slice(0,15)}));

for (const province of ['เชียงใหม่','กาญจนบุรี','นครราชสีมา']) {
  const p = await buildHistoricalProvince(province);
  console.log('[historical14y-qc] province=' + JSON.stringify({
    province:p.province,
    ok:p.ok,
    coverage:p.coverage,
    districtCount:p.districtCount,
    recurringDistrictCount:p.recurringDistrictCount,
    maxYears:p.maxYears,
    ge7:(p.ranking || []).filter(d => Number(d.yearCount) >= 7).length,
    ge10:(p.ranking || []).filter(d => Number(d.yearCount) >= 10).length,
    topDistricts:p.topDistricts?.slice(0,5),
    yearDistrictCounts:p.yearDistrictCounts,
  }));
}

if (!audit.ok) throw new Error('Historical 14-year QC failed: ' + JSON.stringify(audit.qc));
if (audit.provinceCount !== 77) throw new Error(`Historical 14-year QC expected 77 provinces, got ${audit.provinceCount}`);
if (audit.coverage?.years !== 14 || audit.coverage?.startBE !== 2554 || audit.coverage?.endBE !== 2567) throw new Error('Historical 14-year coverage is not B.E. 2554-2567');
if (allDistricts.length > 928) throw new Error(`District deduplication failed: ${allDistricts.length}`);
console.log('[historical14y-qc] PASS');

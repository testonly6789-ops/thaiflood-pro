import { auditHistoricalSources, buildHistoricalProvince } from '../lib/historical-14y-engine.js';

console.log('[historical14y-qc] start');
const audit = await auditHistoricalSources();
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

for (const province of ['เชียงใหม่','กาญจนบุรี','นครราชสีมา']) {
  const p = await buildHistoricalProvince(province);
  console.log('[historical14y-qc] province=' + JSON.stringify({
    province:p.province,
    ok:p.ok,
    coverage:p.coverage,
    districtCount:p.districtCount,
    recurringDistrictCount:p.recurringDistrictCount,
    maxYears:p.maxYears,
    topDistricts:p.topDistricts?.slice(0,5),
    yearDistrictCounts:p.yearDistrictCounts,
  }));
}

if (!audit.ok) throw new Error('Historical 14-year QC failed: ' + JSON.stringify(audit.qc));
if (audit.provinceCount !== 77) throw new Error(`Historical 14-year QC expected 77 provinces, got ${audit.provinceCount}`);
if (audit.coverage?.years !== 14 || audit.coverage?.startBE !== 2554 || audit.coverage?.endBE !== 2567) throw new Error('Historical 14-year coverage is not B.E. 2554-2567');
console.log('[historical14y-qc] PASS');

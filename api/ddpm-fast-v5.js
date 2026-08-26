import baseHandler from './ddpm-fast-v4.js';

function addSpatialRecurrence(payload) {
  if (!payload?.ok) return payload;

  const detailStatuses = (payload.status || []).filter(s => s.mode === 'district-detail' && s.ok);
  const checkedYears = detailStatuses.map(s => Number(s.year)).filter(Number.isFinite).sort((a,b)=>a-b);
  const districtYears = new Map();

  for (const year of payload.years || []) {
    const y = Number(year.year);
    if (!Number.isFinite(y)) continue;
    const names = year.allDistricts || year.districts || [];
    for (const raw of names) {
      const district = String(raw || '').trim();
      if (!district || /^\d+(?:\.\d+)?$/.test(district)) continue;
      if (!districtYears.has(district)) districtYears.set(district, new Set());
      districtYears.get(district).add(y);
    }
  }

  const ranked = [...districtYears.entries()]
    .map(([district, years]) => ({ district, years:[...years].sort((a,b)=>a-b), yearCount:years.size }))
    .sort((a,b) => b.yearCount - a.yearCount || a.district.localeCompare(b.district,'th'));

  const maxYears = ranked[0]?.yearCount || 0;
  const repeatDistricts = maxYears >= 2 ? ranked.filter(x => x.yearCount === maxYears).map(x => x.district) : [];
  const recurringDistricts = ranked.filter(x => x.yearCount >= 2);

  return {
    ...payload,
    summary: {
      ...(payload.summary || {}),
      spatialRepeatMaxYears:maxYears,
      spatialRepeatDistricts:repeatDistricts.slice(0,8),
      spatialRepeatDistrictCount:repeatDistricts.length,
      recurringDistrictCount:recurringDistricts.length,
      spatialRepeatCheckedYears:checkedYears.length,
      spatialRepeatYearList:checkedYears,
      spatialRepeatTop:ranked.slice(0,12),
    },
    spatialRecurrence: {
      level:'district',
      definition:'นับจำนวนปีที่อำเภอเดิมมีรายงานอุทกภัยซ้ำ โดยใช้เฉพาะปีที่ต้นทางมีชื่ออำเภอเปรียบเทียบกันได้',
      checkedYears,
      checkedYearCount:checkedYears.length,
      maxYears,
      topDistricts:repeatDistricts.slice(0,8),
      topDistrictCount:repeatDistricts.length,
      recurringDistrictCount:recurringDistricts.length,
      ranking:ranked.slice(0,20),
      excludedProvinceSummaryYears:(payload.provinceSummaryYears || []).map(y => Number(y.year)).filter(Number.isFinite).sort((a,b)=>a-b),
    },
  };
}

export { addSpatialRecurrence };

export default async function handler(req, res) {
  let statusCode = 200;
  const proxy = {
    status(code) { statusCode = code; return proxy; },
    setHeader(name, value) { res.setHeader(name, value); return proxy; },
    json(payload) { return res.status(statusCode).json(addSpatialRecurrence(payload)); },
  };
  return baseHandler(req, proxy);
}

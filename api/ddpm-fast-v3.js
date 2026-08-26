import baseHandler from './ddpm-fast-v2.js';

const positive = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
};

function hasFloodEvidence(year) {
  if (!year) return false;

  // District-detail datasets are incident-area records. Require both records
  // and at least one valid district so headers/codes cannot become a flood year.
  if (year.evidenceLevel === 'district-detail') {
    return positive(year.recordCount) && positive(year.districtCount);
  }

  // Province-summary datasets (2562 / 2568) have different schemas.
  // Count the year only when the row contains a positive flood-impact signal,
  // not merely because a province row exists in the source table.
  return [
    year.occurrenceCount,
    year.districtCount,
    year.households,
    year.population,
    year.deaths,
    year.missing,
    year.injured,
    year.agriRai,
    year.totalDamageThb,
    year.agriDamageThb,
  ].some(positive);
}

function addFloodRecurrence(payload) {
  if (!payload?.ok) return payload;

  const allYears = [
    ...(Array.isArray(payload.years) ? payload.years : []),
    ...(Array.isArray(payload.provinceSummaryYears) ? payload.provinceSummaryYears : []),
  ];

  const floodYears = allYears
    .filter(hasFloodEvidence)
    .sort((a, b) => Number(b.year) - Number(a.year));

  const floodYearList = floodYears
    .map((item) => Number(item.year))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const sourceStart = Number(payload.sourceCoverage?.start || 2562);
  const sourceEnd = Number(payload.sourceCoverage?.end || 2568);
  const checkedYears = sourceEnd >= sourceStart ? (sourceEnd - sourceStart + 1) : null;

  payload.summary = {
    ...(payload.summary || {}),
    floodYears: floodYearList.length,
    floodYearList,
    checkedYears,
    floodRepeatRatePct: checkedYears ? Math.round((floodYearList.length / checkedYears) * 1000) / 10 : null,
  };

  payload.floodYears = floodYears;
  payload.recurrenceDefinition = 'นับเฉพาะปีที่มีหลักฐานอุทกภัยจริง ไม่ได้นับเพียงการมีแถวข้อมูลในฐาน ปภ.';
  return payload;
}

export default async function handler(req, res) {
  let statusCode = 200;

  const proxy = {
    status(code) {
      statusCode = code;
      return proxy;
    },
    setHeader(name, value) {
      res.setHeader(name, value);
      return proxy;
    },
    json(payload) {
      return res.status(statusCode).json(addFloodRecurrence(payload));
    },
  };

  return baseHandler(req, proxy);
}

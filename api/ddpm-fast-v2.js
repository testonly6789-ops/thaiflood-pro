const RESOURCES = [
  {
    year: 2562,
    id: '8c477d58-3ae9-436f-9e3d-f7d302fe8197',
    mode: 'province-summary',
    fields: {
      province: 'Province', districtCount: 'District', households: 'households', population: 'Population',
      deaths: 'Deaths', missing: 'Missing', injured: 'Injured', rice: 'Rice Fields', garden: 'Garden Crops',
      fieldCrop: 'Field Crops', totalDamage: 'Total Damage (THB)', agriDamage: 'Agri. Damage (THB)'
    },
  },
  {
    year: 2563,
    id: '27e81e82-7cdc-4fe9-94b9-f3ca193c2328',
    mode: 'district-detail',
    fields: { province: 'province', district: 'district', cause: 'Flood Type' },
  },
  {
    year: 2564,
    id: 'beb61961-ded4-447d-a348-8a39623e95d4',
    mode: 'district-detail',
    fields: { province: 'province', district: 'district' },
  },
  {
    year: 2565,
    id: 'bc36c686-79f3-4574-a654-54cf0ef00d82',
    mode: 'district-detail',
    fields: { province: 'province', district: 'district' },
  },
  {
    year: 2566,
    id: 'af2370d1-d2d0-4844-a16d-e6af34926e71',
    mode: 'district-detail',
    fields: {
      province: 'Province', district: 'District', cause: 'Cause', households: 'Affected Households',
      population: 'Affected People', deaths: 'Deaths', missing: 'Missing', injured: 'Injured', agri: 'Agriculture Damage'
    },
  },
  {
    year: 2567,
    id: 'dde2eddc-28f5-40bf-8a62-28bc68f02af8',
    mode: 'district-detail',
    fields: {
      province: 'Province', district: 'District', cause: 'Nature/Cause', households: 'Affected Households',
      population: 'Affected People', deaths: 'fatalities_count', missing: 'Missing Persons', injured: 'injuries_count',
      agri: 'Agriculture (Acres)'
    },
  },
  {
    year: 2568,
    id: '9eae087c-8931-4a74-9968-200cdb3d2fb3',
    mode: 'province-summary',
    fields: {
      province: 'Province', occurrenceCount: 'Time', districtCount: 'District', households: 'Affected Households',
      population: 'Affected People', deaths: 'fatalities_count', missing: 'Missing Persons', injured: 'injuries_count',
      agri: 'Agriculture (Acres)'
    },
  },
];

const API = 'https://catalog.disaster.go.th/api/3/action/datastore_search';
const THAI_DIGITS = { '๐':'0','๑':'1','๒':'2','๓':'3','๔':'4','๕':'5','๖':'6','๗':'7','๘':'8','๙':'9' };
const latinizeDigits = (s='') => String(s).replace(/[๐-๙]/g, d => THAI_DIGITS[d] || d);
const num = (v) => {
  if (v == null || v === '' || v === '-' || v === '—') return null;
  const cleaned = latinizeDigits(v).replace(/,/g,'').replace(/[^0-9.+-]/g,'');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};
const cleanProvince = (v='') => String(v || '').trim().replace(/^จังหวัด\s*/, '');
const cleanDistrict = (v='') => {
  const value = String(v || '').trim().replace(/^อำเภอ\s*/, '');
  return /^\d+(?:\.\d+)?$/.test(latinizeDigits(value)) ? '' : value;
};

async function getJson(url, timeout = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'ThaiFlood-Intelligence/6.0' }, signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (!data?.success) throw new Error('CKAN success=false');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function selectedFields(resource) {
  return [...new Set(Object.values(resource.fields || {}).filter(Boolean))];
}

async function fetchRows(resource, province) {
  const makeUrl = (useFilter) => {
    const u = new URL(API);
    u.searchParams.set('resource_id', resource.id);
    u.searchParams.set('limit', resource.mode === 'province-summary' ? '100' : '10000');
    u.searchParams.set('offset', '0');
    const fields = selectedFields(resource);
    if (fields.length) u.searchParams.set('fields', fields.join(','));
    if (useFilter) u.searchParams.set('filters', JSON.stringify({ [resource.fields.province]: province }));
    else u.searchParams.set('q', province);
    return u;
  };

  let data = await getJson(makeUrl(true));
  let records = data.result?.records || [];
  if (!records.length) {
    data = await getJson(makeUrl(false));
    records = data.result?.records || [];
  }

  const exact = records.filter(row => {
    const p = cleanProvince(row?.[resource.fields.province]);
    return p === province;
  });
  return { year: resource.year, ok: true, records: exact, total: exact.length, resource };
}

function sumRows(rows, field) {
  if (!field) return null;
  const vals = rows.map(r => num(r?.[field])).filter(v => v != null);
  return vals.length ? vals.reduce((a,b)=>a+b,0) : null;
}

function agricultureRai(rows, fields) {
  if (fields.agri) return sumRows(rows, fields.agri);
  const parts = [fields.rice, fields.garden, fields.fieldCrop].map(f => sumRows(rows, f)).filter(v => v != null);
  return parts.length ? parts.reduce((a,b)=>a+b,0) : null;
}

function aggregate(result) {
  const { year, records: rows, resource } = result;
  if (!rows.length) return null;
  const f = resource.fields;
  const totalDamageThb = sumRows(rows, f.totalDamage);
  const agriDamageThb = sumRows(rows, f.agriDamage);

  if (resource.mode === 'province-summary') {
    return {
      year,
      evidenceLevel: 'province-summary',
      recordCount: rows.length,
      occurrenceCount: sumRows(rows, f.occurrenceCount),
      districtCount: sumRows(rows, f.districtCount),
      districts: [],
      allDistricts: [],
      subdistricts: [],
      affectedAreas: [],
      causes: [],
      descriptions: [],
      households: sumRows(rows, f.households),
      population: sumRows(rows, f.population),
      deaths: sumRows(rows, f.deaths),
      missing: sumRows(rows, f.missing),
      injured: sumRows(rows, f.injured),
      agriRai: agricultureRai(rows, f),
      reliefBudgetThb: null,
      reliefBudgetM: null,
      cropCompensationThb: null,
      cropCompensationM: null,
      totalDamageThb,
      totalDamageM: totalDamageThb == null ? null : totalDamageThb / 1_000_000,
      agriDamageThb,
      agriDamageM: agriDamageThb == null ? null : agriDamageThb / 1_000_000,
      source: 'DDPM Open Data',
    };
  }

  const allDistricts = [...new Set(rows.map(r => cleanDistrict(r?.[f.district])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
  const causes = [...new Set(rows.map(r => String(r?.[f.cause] || '').trim()).filter(Boolean))].slice(0, 4);
  return {
    year,
    evidenceLevel: 'district-detail',
    recordCount: rows.length,
    occurrenceCount: null,
    districtCount: allDistricts.length,
    districts: allDistricts.slice(0, 5),
    allDistricts,
    subdistricts: [],
    affectedAreas: [],
    causes,
    descriptions: [],
    households: sumRows(rows, f.households),
    population: sumRows(rows, f.population),
    deaths: sumRows(rows, f.deaths),
    missing: sumRows(rows, f.missing),
    injured: sumRows(rows, f.injured),
    agriRai: agricultureRai(rows, f),
    reliefBudgetThb: null,
    reliefBudgetM: null,
    cropCompensationThb: null,
    cropCompensationM: null,
    totalDamageThb,
    totalDamageM: totalDamageThb == null ? null : totalDamageThb / 1_000_000,
    agriDamageThb,
    agriDamageM: agriDamageThb == null ? null : agriDamageThb / 1_000_000,
    source: 'DDPM Open Data',
  };
}

export default async function handler(req, res) {
  const province = String(req.query?.province || '').trim();
  if (!province) return res.status(400).json({ ok:false, error:'province is required' });

  const started = Date.now();
  const settled = await Promise.all(RESOURCES.map(async resource => {
    try { return await fetchRows(resource, province); }
    catch (error) { return { year:resource.year, ok:false, records:[], total:0, error:error.message, resource }; }
  }));

  const allYears = settled.filter(r=>r.ok).map(aggregate).filter(Boolean).sort((a,b)=>b.year-a.year);
  const years = allYears.filter(y => y.evidenceLevel === 'district-detail' && Number(y.districtCount || 0) > 0);
  const provinceSummaryYears = allYears.filter(y => y.evidenceLevel === 'province-summary');
  const sumAll = (key) => {
    const vals = allYears.map(y=>y[key]).filter(v=>v != null);
    return vals.length ? vals.reduce((a,b)=>a+b,0) : null;
  };
  const districtNames = [...new Set(years.flatMap(y=>y.allDistricts || y.districts || []))].slice(0, 10);
  const districtCount = Math.max(0, ...years.map(y=>Number(y.districtCount || 0)));

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('CDN-Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=43200, stale-while-revalidate=604800');
  return res.status(200).json({
    ok:true,
    province,
    source:'กรมป้องกันและบรรเทาสาธารณภัย (ปภ.) — CKAN Data API',
    sourceUrl:'https://catalog.disaster.go.th/dataset/dpm-gd027',
    coverage:{ start:2563, end:2567 },
    sourceCoverage:{ start:2562, end:2568 },
    fetchedAt:new Date().toISOString(),
    elapsedMs:Date.now()-started,
    status:settled.map(r=>({ year:r.year, ok:r.ok, total:r.total || 0, mode:r.resource?.mode || null, error:r.error || null })),
    summary:{
      officialYearsWithRecords:years.length || null,
      confirmedAreaYears:years.length,
      dataYearsTotal:allYears.length,
      provinceSummaryYears:provinceSummaryYears.map(y=>y.year),
      districts:districtNames,
      districtCount:districtCount || null,
      households:sumAll('households'),
      population:sumAll('population'),
      deaths:sumAll('deaths'),
      missing:sumAll('missing'),
      injured:sumAll('injured'),
      agriRai:sumAll('agriRai'),
      totalDamageM:sumAll('totalDamageM'),
      agriDamageM:sumAll('agriDamageM'),
      reliefBudgetM:null,
      cropCompensationM:null,
    },
    years,
    provinceSummaryYears,
  });
}

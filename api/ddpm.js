const RESOURCES = [
  { year: 2562, id: '8c477d58-3ae9-436f-9e3d-f7d302fe8197' },
  { year: 2563, id: '27e81e82-7cdc-4fe9-94b9-f3ca193c2328' },
  { year: 2564, id: 'beb61961-ded4-447d-a348-8a39623e95d4' },
  { year: 2565, id: 'bc36c686-79f3-4574-a654-54cf0ef00d82' },
  { year: 2566, id: 'af2370d1-d2d0-4844-a16d-e6af34926e71' },
  { year: 2567, id: 'dde2eddc-28f5-40bf-8a62-28bc68f02af8' },
  { year: 2568, id: '9eae087c-8931-4a74-9968-200cdb3d2fb3' },
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
const norm = (s='') => String(s).toLowerCase().replace(/[._()\s'’"-]/g,'');

function keyOf(record, patterns) {
  const keys = Object.keys(record || {});
  for (const pattern of patterns) {
    const found = keys.find(k => pattern.test(norm(k)) || pattern.test(String(k)));
    if (found) return found;
  }
  return null;
}

function valueOf(record, patterns) {
  const k = keyOf(record, patterns);
  return k ? record[k] : null;
}

function sumFields(record, patternGroups) {
  let total = 0;
  let found = false;
  for (const patterns of patternGroups) {
    const v = num(valueOf(record, patterns));
    if (v != null) { total += v; found = true; }
  }
  return found ? total : null;
}

function normalizeProvinceName(v='') {
  return String(v).trim().replace(/^จังหวัด\s*/,'').replace(/^จ\.\s*/,'');
}

function normalizeDistrictName(v='') {
  return String(v).trim().replace(/^อำเภอ\s*/,'').replace(/^อ\.\s*/,'');
}

function parseRecord(record, year) {
  const provinceRaw = valueOf(record, [/^province$/i,/province/i,/จังหวัด/]);
  const districtRaw = valueOf(record, [/^district$/i,/district/i,/อำเภอ/]);
  const subdistrictRaw = valueOf(record, [/subdistrict/i,/ตำบล/]);
  const province = normalizeProvinceName(provinceRaw || '');
  const district = normalizeDistrictName(districtRaw || '');
  const subdistrict = String(subdistrictRaw || '').trim();

  const households = num(valueOf(record, [/households/i,/ครัวเรือน/ ]));
  const population = num(valueOf(record, [/population/i,/ประชากร/ ]));
  const deaths = num(valueOf(record, [/deaths?/i,/เสียชีวิต/ ]));
  const missing = num(valueOf(record, [/missing/i,/สูญหาย/ ]));
  const injured = num(valueOf(record, [/injured/i,/บาดเจ็บ/ ]));

  const totalDamageThb = num(valueOf(record, [/totaldamage/i,/ความเสียหายรวม/i,/มูลค่ารวม/i]));
  const agriDamageThb = num(valueOf(record, [/agridamage/i,/agriculturaldamage/i,/ความเสียหาย.*เกษตร/i]));
  const housingDamageThb = num(valueOf(record, [/housingdamage/i,/ความเสียหาย.*ที่อยู่อาศัย/i]));
  const economicDamageThb = num(valueOf(record, [/econdamage/i,/economicdamage/i,/ความเสียหาย.*เศรษฐกิจ/i]));
  const publicDamageThb = num(valueOf(record, [/pubdamage/i,/publicdamage/i,/ความเสียหาย.*สาธารณ/i]));

  const agriRai = sumFields(record, [
    [/ricefields/i,/rice/i,/นาข้าว/i,/ข้าว/i],
    [/gardencrops/i,/สวน/i],
    [/fieldcrops/i,/พืชไร่/i],
  ]);

  const dates = {
    situation: valueOf(record, [/situationdate/i,/วันที่.*สถานการณ์/i]),
    disasterArea: valueOf(record, [/disasterareadate/i,/วันที่.*เขตภัย/i]),
    reliefDeclared: valueOf(record, [/reliefdeclareddate/i,/วันที่.*ช่วยเหลือ/i]),
    end: valueOf(record, [/enddisasterdate/i,/วันที่.*สิ้นสุด/i]),
  };

  return {
    year, province, district, subdistrict,
    households, population, deaths, missing, injured,
    totalDamageThb, agriDamageThb, housingDamageThb, economicDamageThb, publicDamageThb,
    agriRai, dates,
    raw: record,
  };
}

async function fetchResource(resource, q) {
  const url = new URL(API);
  url.searchParams.set('resource_id', resource.id);
  url.searchParams.set('limit', '10000');
  url.searchParams.set('offset', '0');
  if (q) url.searchParams.set('q', q);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'ThaiFlood-Intelligence/4.0' }, signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (!data?.success) throw new Error('CKAN API returned success=false');
    return { year: resource.year, ok: true, total: data.result?.total || 0, records: data.result?.records || [] };
  } catch (error) {
    return { year: resource.year, ok: false, total: 0, records: [], error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

function aggregateYear(rows, year, requestedProvince) {
  const parsed = rows.map(r => parseRecord(r, year)).filter(r => r.province);
  const provinceRows = requestedProvince
    ? parsed.filter(r => r.province === requestedProvince || r.province.includes(requestedProvince) || requestedProvince.includes(r.province))
    : parsed;
  if (!provinceRows.length) return null;

  const districts = [...new Set(provinceRows.map(r => r.district).filter(Boolean))];
  const subdistricts = [...new Set(provinceRows.map(r => r.subdistrict).filter(Boolean))];
  const sum = (key) => {
    const vals = provinceRows.map(r => r[key]).filter(v => v != null);
    return vals.length ? vals.reduce((a,b)=>a+b,0) : null;
  };
  const totalDamageThb = sum('totalDamageThb');
  const agriDamageThb = sum('agriDamageThb');
  const housingDamageThb = sum('housingDamageThb');
  const economicDamageThb = sum('economicDamageThb');
  const publicDamageThb = sum('publicDamageThb');

  return {
    year,
    recordCount: provinceRows.length,
    districts,
    subdistricts,
    households: sum('households'),
    population: sum('population'),
    deaths: sum('deaths'),
    missing: sum('missing'),
    injured: sum('injured'),
    agriRai: sum('agriRai'),
    totalDamageThb,
    totalDamageM: totalDamageThb == null ? null : totalDamageThb / 1_000_000,
    agriDamageThb,
    agriDamageM: agriDamageThb == null ? null : agriDamageThb / 1_000_000,
    housingDamageThb,
    economicDamageThb,
    publicDamageThb,
    source: 'DDPM Open Data',
  };
}

export default async function handler(req, res) {
  const province = String(req.query?.province || '').trim();
  if (!province) {
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({
      ok: true,
      source: 'กรมป้องกันและบรรเทาสาธารณภัย (ปภ.) — สถิติรายปีการเกิดอุทกภัย',
      coverage: { start: 2562, end: 2568 },
      resources: RESOURCES.map(r => ({ year:r.year, resourceId:r.id })),
      note: 'เรียก /api/ddpm?province=ชื่อจังหวัด เพื่อโหลดข้อมูลทางการของจังหวัดนั้นแบบอัตโนมัติ',
    });
  }

  const results = await Promise.all(RESOURCES.map(r => fetchResource(r, province)));
  const years = [];
  const status = [];
  for (const r of results) {
    status.push({ year:r.year, ok:r.ok, total:r.total, error:r.error || null });
    if (!r.ok) continue;
    const agg = aggregateYear(r.records, r.year, province);
    if (agg) years.push(agg);
  }

  years.sort((a,b)=>b.year-a.year);
  const sum = (key) => {
    const vals = years.map(y => y[key]).filter(v => v != null);
    return vals.length ? vals.reduce((a,b)=>a+b,0) : null;
  };
  const districts = [...new Set(years.flatMap(y => y.districts || []))];

  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
  res.status(200).json({
    ok: true,
    province,
    source: 'กรมป้องกันและบรรเทาสาธารณภัย (ปภ.) — CKAN Data API',
    sourceUrl: 'https://catalog.disaster.go.th/dataset/dpm-gd027',
    coverage: { start:2562, end:2568 },
    fetchedAt: new Date().toISOString(),
    status,
    summary: {
      officialYearsWithRecords: years.length,
      districts,
      households: sum('households'),
      population: sum('population'),
      deaths: sum('deaths'),
      missing: sum('missing'),
      injured: sum('injured'),
      agriRai: sum('agriRai'),
      totalDamageM: sum('totalDamageM'),
      agriDamageM: sum('agriDamageM'),
    },
    years,
  });
}
